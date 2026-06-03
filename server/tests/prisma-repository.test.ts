/**
 * Integration tests for PrismaAlbumRepository
 *
 * These tests require a live PostgreSQL database.  Set DATABASE_URL before
 * running them, e.g.:
 *
 *   DATABASE_URL=postgresql://albumatlas:albumatlas123@localhost:5432/albumatlas_test \
 *   npx vitest run tests/prisma-repository.test.ts
 *
 * The entire suite is SKIPPED when DATABASE_URL is not set so the regular
 * unit-test run (no database) remains green.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Album, Track } from "../src/types.js";

const DB_URL = process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALBUM: Album = {
  id: "prisma-test-album",
  title: "Prisma Test Album",
  artist: "Test Artist",
  year: 2024,
  genre: "Jazz",
  coverUrl: "https://example.com/cover.jpg",
  description: "Integration test album",
  rating: 4.5,
  featured: false,
};

const TRACK: Track = {
  id: "prisma-test-album-track-1",
  albumId: "prisma-test-album",
  title: "Test Track",
  position: 1,
  durationSec: 240,
};

// ---------------------------------------------------------------------------
// Suite (skipped automatically when no DATABASE_URL)
// ---------------------------------------------------------------------------

describe.skipIf(!DB_URL)("PrismaAlbumRepository – integration", () => {
  // Dynamic imports so the Prisma client is only loaded when DATABASE_URL exists.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    const { PrismaAlbumRepository } = await import("../src/prisma-repository.js");
    prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    repo = new PrismaAlbumRepository(prisma);
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up everything this test suite wrote
    await prisma.track.deleteMany();
    await prisma.album.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset to a known state before each test
    await repo.resetAndSync([ALBUM], [TRACK]);
  });

  // ── resetAndSync ──────────────────────────────────────────────────────────

  it("resetAndSync populates the database", async () => {
    const dbAlbum = await prisma.album.findUnique({ where: { id: ALBUM.id } });
    expect(dbAlbum).not.toBeNull();
    expect(dbAlbum.title).toBe(ALBUM.title);
    expect(dbAlbum.rating).toBe(ALBUM.rating);

    const dbTrack = await prisma.track.findUnique({ where: { id: TRACK.id } });
    expect(dbTrack).not.toBeNull();
    expect(dbTrack.title).toBe(TRACK.title);
  });

  it("resetAndSync clears previous data", async () => {
    // Put in a different album
    await repo.resetAndSync(
      [{ ...ALBUM, id: "different-album", title: "Different" }],
      [],
    );
    const old = await prisma.album.findUnique({ where: { id: ALBUM.id } });
    expect(old).toBeNull();
    const newOne = await prisma.album.findUnique({ where: { id: "different-album" } });
    expect(newOne).not.toBeNull();
  });

  // ── loadFromDatabase ──────────────────────────────────────────────────────

  it("loadFromDatabase loads albums and tracks into memory", async () => {
    // Create a fresh repo instance with empty memory
    const { PrismaAlbumRepository } = await import("../src/prisma-repository.js");
    const fresh = new PrismaAlbumRepository(prisma);

    await fresh.loadFromDatabase();

    expect(fresh.getAlbum(ALBUM.id)).toBeDefined();
    expect(fresh.listTracksByAlbum(ALBUM.id)).toHaveLength(1);
  });

  // ── createAlbum ───────────────────────────────────────────────────────────

  it("createAlbum persists to the database", async () => {
    const created = repo.createAlbum({
      title: "New DB Album",
      artist: "DB Artist",
      year: 2025,
      genre: "Rock",
      coverUrl: "https://example.com/new.jpg",
      description: "",
      rating: 3.0,
      featured: false,
    });

    await repo.flushWrites();

    const dbRow = await prisma.album.findUnique({ where: { id: created.id } });
    expect(dbRow).not.toBeNull();
    expect(dbRow.title).toBe("New DB Album");
    expect(dbRow.artist).toBe("DB Artist");
    expect(dbRow.year).toBe(2025);
    expect(dbRow.genre).toBe("Rock");
    expect(dbRow.rating).toBe(3.0);
  });

  it("createAlbum also updates in-memory state", () => {
    const created = repo.createAlbum({
      title: "In-Mem Album",
      artist: "Someone",
      year: 2020,
      genre: "Pop",
      coverUrl: "https://example.com/x.jpg",
      description: "",
      rating: 2.0,
      featured: false,
    });

    expect(repo.getAlbum(created.id)).toBeDefined();
    expect(repo.getAlbum(created.id)?.title).toBe("In-Mem Album");
  });

  // ── updateAlbum ───────────────────────────────────────────────────────────

  it("updateAlbum persists the change to the database", async () => {
    repo.updateAlbum(ALBUM.id, { title: "Updated Title", rating: 4.9 });
    await repo.flushWrites();

    const dbRow = await prisma.album.findUnique({ where: { id: ALBUM.id } });
    expect(dbRow.title).toBe("Updated Title");
    expect(dbRow.rating).toBe(4.9);
  });

  it("updateAlbum returns undefined for a non-existent album", () => {
    expect(repo.updateAlbum("no-such-id", { title: "X" })).toBeUndefined();
  });

  // ── deleteAlbum ───────────────────────────────────────────────────────────

  it("deleteAlbum removes the row from the database", async () => {
    repo.deleteAlbum(ALBUM.id);
    await repo.flushWrites();

    const dbRow = await prisma.album.findUnique({ where: { id: ALBUM.id } });
    expect(dbRow).toBeNull();
  });

  it("deleteAlbum cascades to tracks in the database", async () => {
    repo.deleteAlbum(ALBUM.id);
    await repo.flushWrites();

    const tracks = await prisma.track.findMany({
      where: { albumId: ALBUM.id },
    });
    expect(tracks).toHaveLength(0);
  });

  it("deleteAlbum returns false for a non-existent album", () => {
    expect(repo.deleteAlbum("ghost")).toBe(false);
  });

  // ── createTrack ───────────────────────────────────────────────────────────

  it("createTrack persists to the database", async () => {
    const track = repo.createTrack(ALBUM.id, {
      title: "New Track",
      position: 2,
      durationSec: 180,
    });
    await repo.flushWrites();

    expect(track).toBeDefined();
    const dbRow = await prisma.track.findUnique({ where: { id: track!.id } });
    expect(dbRow).not.toBeNull();
    expect(dbRow.title).toBe("New Track");
    expect(dbRow.albumId).toBe(ALBUM.id);
  });

  it("createTrack returns undefined for a missing album", () => {
    expect(
      repo.createTrack("ghost-album", { title: "X", position: 1, durationSec: 60 }),
    ).toBeUndefined();
  });

  // ── updateTrack ───────────────────────────────────────────────────────────

  it("updateTrack persists the change to the database", async () => {
    repo.updateTrack(TRACK.id, { title: "Renamed Track", durationSec: 300 });
    await repo.flushWrites();

    const dbRow = await prisma.track.findUnique({ where: { id: TRACK.id } });
    expect(dbRow.title).toBe("Renamed Track");
    expect(dbRow.durationSec).toBe(300);
  });

  it("updateTrack returns undefined for a non-existent track", () => {
    expect(repo.updateTrack("ghost", { title: "X" })).toBeUndefined();
  });

  // ── deleteTrack ───────────────────────────────────────────────────────────

  it("deleteTrack removes the row from the database", async () => {
    repo.deleteTrack(TRACK.id);
    await repo.flushWrites();

    const dbRow = await prisma.track.findUnique({ where: { id: TRACK.id } });
    expect(dbRow).toBeNull();
  });

  it("deleteTrack returns undefined for a non-existent track", () => {
    expect(repo.deleteTrack("ghost")).toBeUndefined();
  });

  // ── statisticsFromDb ──────────────────────────────────────────────────────

  it("statisticsFromDb returns correct album count", async () => {
    const stats = await repo.statisticsFromDb();
    expect(stats.albumCount).toBe(1);
  });

  it("statisticsFromDb calculates average rating", async () => {
    const stats = await repo.statisticsFromDb();
    expect(stats.averageRating).toBe(4.5);
  });

  it("statisticsFromDb aggregates by genre", async () => {
    const stats = await repo.statisticsFromDb();
    expect(stats.byGenre).toEqual([{ genre: "Jazz", albumCount: 1 }]);
  });

  it("statisticsFromDb aggregates by decade", async () => {
    const stats = await repo.statisticsFromDb();
    expect(stats.byDecade).toEqual([{ decade: "2020s", albumCount: 1 }]);
  });

  it("statisticsFromDb returns top-rated albums", async () => {
    const stats = await repo.statisticsFromDb();
    expect(stats.topRated).toHaveLength(1);
    expect(stats.topRated[0].id).toBe(ALBUM.id);
  });

  it("statisticsFromDb handles empty repository", async () => {
    await repo.resetAndSync([], []);
    const stats = await repo.statisticsFromDb();
    expect(stats.albumCount).toBe(0);
    expect(stats.averageRating).toBe(0);
    expect(stats.byGenre).toHaveLength(0);
    expect(stats.byDecade).toHaveLength(0);
    expect(stats.topRated).toHaveLength(0);
  });

  // ── FK integrity ──────────────────────────────────────────────────────────

  it("database enforces FK: track cannot reference a non-existent album", async () => {
    await expect(
      prisma.track.create({
        data: {
          id: "orphan-track",
          albumId: "non-existent-album",
          title: "Orphan",
          position: 1,
          durationSec: 60,
        },
      }),
    ).rejects.toThrow();
  });
});
