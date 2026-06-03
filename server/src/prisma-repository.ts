/**
 * PrismaAlbumRepository
 *
 * Extends the in-memory AlbumRepository with write-through PostgreSQL
 * persistence via Prisma ORM.
 *
 * Read path  → always from the in-memory Maps (loaded on startup from DB).
 * Write path → synchronously updates in-memory, then asynchronously persists
 *              to PostgreSQL.  All pending writes are tracked so tests can
 *              call await repo.flushWrites() before asserting DB state.
 *
 * This design keeps the entire existing synchronous service/route/test surface
 * unchanged while adding durable storage.
 */

import type { PrismaClient } from "@prisma/client";
import { AlbumRepository } from "./repository.js";
import type {
  Album,
  AlbumInput,
  AlbumPatch,
  Track,
  TrackInput,
  TrackPatch,
} from "./types.js";

export class PrismaAlbumRepository extends AlbumRepository {
  /** Tracks pending async DB writes so tests can await them. */
  private readonly _pending: Promise<void>[] = [];

  constructor(private readonly db: PrismaClient) {
    super();
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /** Register a DB write promise; swallow errors (logged). */
  private track(p: Promise<unknown>, label: string): void {
    const safe = p
      .then(() => undefined as void)
      .catch((err) => {
        console.error(`[PrismaRepo] ${label} failed:`, err);
      });
    this._pending.push(safe);
  }

  /**
   * Wait for every pending DB write to settle.
   * Call this in tests before querying the database directly.
   */
  async flushWrites(): Promise<void> {
    await Promise.allSettled(this._pending);
    this._pending.length = 0;
  }

  // ── seeding / reset ───────────────────────────────────────────────────────

  /**
   * Load all albums and tracks from PostgreSQL into the in-memory Maps.
   * Call this once on server startup.
   */
  async loadFromDatabase(): Promise<void> {
    const [albums, tracks] = await Promise.all([
      this.db.album.findMany(),
      this.db.track.findMany(),
    ]);
    super.reset(albums as Album[], tracks as Track[]);
  }

  /**
   * Atomically replace the DB contents AND in-memory state.
   * Used on first boot (seeding) and in integration tests.
   */
  async resetAndSync(albums: Album[] = [], tracks: Track[] = []): Promise<void> {
    // 1. Wipe DB (tracks first to satisfy FK, then albums)
    await this.db.$transaction([
      this.db.track.deleteMany(),
      this.db.album.deleteMany(),
    ]);

    // 2. Insert new seed data
    if (albums.length > 0) {
      await this.db.album.createMany({ data: albums });
    }
    if (tracks.length > 0) {
      await this.db.track.createMany({ data: tracks });
    }

    // 3. Sync in-memory state
    super.reset(albums, tracks);
  }

  async refreshRatingsFromReviews(): Promise<void> {
    const averages = await this.db.review.groupBy({
      by: ["albumId"],
      _avg: { rating: true },
    });
    const avgMap = new Map(
      averages.map((g) => [g.albumId, Number((g._avg.rating ?? 0).toFixed(2))]),
    );
    const updates = this.allAlbums().map((album) => {
      const rating = avgMap.get(album.id) ?? 0;
      super.updateAlbum(album.id, { rating });
      return this.db.album.update({ where: { id: album.id }, data: { rating } });
    });
    await this.db.$transaction(updates);
  }

  // ── albums ────────────────────────────────────────────────────────────────

  createAlbum(input: AlbumInput): Album {
    const album = super.createAlbum(input);
    this.track(
      this.db.album.create({ data: album }),
      `createAlbum(${album.id})`,
    );
    return album;
  }

  updateAlbum(id: string, patch: AlbumPatch): Album | undefined {
    const album = super.updateAlbum(id, patch);
    if (album) {
      // Build only the fields actually present in the patch
      const data: Partial<Album> = { ...patch };
      this.track(
        this.db.album.update({ where: { id }, data }),
        `updateAlbum(${id})`,
      );
    }
    return album;
  }

  deleteAlbum(id: string): boolean {
    const existed = super.deleteAlbum(id);
    if (existed) {
      // Cascade delete of tracks is handled by the FK constraint
      this.track(
        this.db.album.delete({ where: { id } }),
        `deleteAlbum(${id})`,
      );
    }
    return existed;
  }

  // ── tracks ────────────────────────────────────────────────────────────────

  createTrack(albumId: string, input: TrackInput): Track | undefined {
    const track = super.createTrack(albumId, input);
    if (track) {
      this.track(
        this.db.track.create({ data: track }),
        `createTrack(${track.id})`,
      );
    }
    return track;
  }

  updateTrack(trackId: string, patch: TrackPatch): Track | undefined {
    const track = super.updateTrack(trackId, patch);
    if (track) {
      const data: Partial<Track> = { ...patch };
      this.track(
        this.db.track.update({ where: { id: trackId }, data }),
        `updateTrack(${trackId})`,
      );
    }
    return track;
  }

  deleteTrack(trackId: string): Track | undefined {
    const track = super.deleteTrack(trackId);
    if (track) {
      this.track(
        this.db.track.delete({ where: { id: trackId } }),
        `deleteTrack(${trackId})`,
      );
    }
    return track;
  }

  // ── statistics (using Prisma aggregation for the DB layer) ────────────────

  /**
   * Returns rich statistics using Prisma GROUP BY and aggregate queries,
   * demonstrating ORM-level data analysis on top of the relational schema.
   *
   * This supplements (and may be used instead of) the in-memory statistics()
   * method in AlbumService for the DATABASE_URL path.
   */
  async statisticsFromDb() {
    const [albumCount, avgResult, genreGroups, topRated] = await Promise.all([
      this.db.album.count(),
      this.db.album.aggregate({ _avg: { rating: true } }),
      this.db.album.groupBy({
        by: ["genre"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      this.db.album.findMany({
        orderBy: { rating: "desc" },
        take: 5,
      }),
    ]);

    const averageRating = Number((avgResult._avg.rating ?? 0).toFixed(2));

    const byGenre = genreGroups.map((g) => ({
      genre: g.genre,
      albumCount: g._count.id,
    }));

    // Decade aggregation via raw SQL (demonstrates stored-query capability)
    const decadeRows = await this.db.$queryRaw<
      Array<{ decade: string; count: bigint }>
    >`
      SELECT
        CONCAT(CAST(FLOOR("year" / 10) * 10 AS TEXT), 's') AS decade,
        COUNT(*)::bigint                                     AS count
      FROM albums
      GROUP BY FLOOR("year" / 10)
      ORDER BY FLOOR("year" / 10)`;

    const byDecade = decadeRows.map((r) => ({
      decade: r.decade,
      albumCount: Number(r.count),
    }));

    return {
      albumCount,
      averageRating,
      byGenre,
      byDecade,
      topRated: topRated as Album[],
    };
  }
}
