import { eventBus } from "./events.js";
import { AlbumRepository, repository as defaultRepo } from "./repository.js";
import type {
  Album,
  AlbumInput,
  AlbumPatch,
  Page,
  PageQuery,
  Track,
  TrackInput,
  TrackPatch,
} from "./types.js";

export class AlbumService {
  constructor(private readonly repo: AlbumRepository = defaultRepo) {}

  listAlbums(query: PageQuery): Page<Album> {
    return this.repo.listAlbums(query);
  }

  getAlbum(id: string): Album | undefined {
    return this.repo.getAlbum(id);
  }

  createAlbum(input: AlbumInput): Album {
    const album = this.repo.createAlbum(input);
    eventBus.emitDomain({ type: "album.created", album });
    return album;
  }

  updateAlbum(id: string, patch: AlbumPatch): Album | undefined {
    const album = this.repo.updateAlbum(id, patch);
    if (album) eventBus.emitDomain({ type: "album.updated", album });
    return album;
  }

  deleteAlbum(id: string): boolean {
    const existed = this.repo.deleteAlbum(id);
    if (existed) eventBus.emitDomain({ type: "album.deleted", albumId: id });
    return existed;
  }

  listTracks(albumId: string): Track[] | undefined {
    if (!this.repo.getAlbum(albumId)) return undefined;
    return this.repo.listTracksByAlbum(albumId);
  }

  getTrack(trackId: string): Track | undefined {
    return this.repo.getTrack(trackId);
  }

  createTrack(albumId: string, input: TrackInput): Track | undefined {
    const track = this.repo.createTrack(albumId, input);
    if (track) eventBus.emitDomain({ type: "track.created", track });
    return track;
  }

  updateTrack(trackId: string, patch: TrackPatch): Track | undefined {
    const track = this.repo.updateTrack(trackId, patch);
    if (track) eventBus.emitDomain({ type: "track.updated", track });
    return track;
  }

  deleteTrack(trackId: string): boolean {
    const removed = this.repo.deleteTrack(trackId);
    if (removed) {
      eventBus.emitDomain({
        type: "track.deleted",
        trackId: removed.id,
        albumId: removed.albumId,
      });
      return true;
    }
    return false;
  }

  statistics() {
    const albums = this.repo.allAlbums();
    const count = albums.length;
    const avgRating =
      count === 0
        ? 0
        : albums.reduce((acc, a) => acc + a.rating, 0) / count;

    const byGenre: Record<string, number> = {};
    const byDecade: Record<string, number> = {};
    for (const a of albums) {
      byGenre[a.genre] = (byGenre[a.genre] ?? 0) + 1;
      const decade = `${Math.floor(a.year / 10) * 10}s`;
      byDecade[decade] = (byDecade[decade] ?? 0) + 1;
    }

    const topRated = [...albums]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);

    return {
      albumCount: count,
      averageRating: Number(avgRating.toFixed(2)),
      byGenre: Object.entries(byGenre)
        .map(([genre, albumCount]) => ({ genre, albumCount }))
        .sort((a, b) => b.albumCount - a.albumCount),
      byDecade: Object.entries(byDecade)
        .map(([decade, albumCount]) => ({ decade, albumCount }))
        .sort((a, b) => a.decade.localeCompare(b.decade)),
      topRated,
    };
  }
}

// Mutable singleton – index.ts swaps this for a PrismaAlbumRepository-backed
// instance when DATABASE_URL is set, without changing any route or test file.
export let service: AlbumService = new AlbumService();

/** Replace the global service instance (called once at startup). */
export function setService(s: AlbumService): void {
  service = s;
}
