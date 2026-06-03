import { describe, it, expect, beforeEach } from "vitest";
import { AlbumRepository } from "../src/repository.js";
import type { Album, Track } from "../src/types.js";

const ALBUM: Album = {
  id: "test-album",
  title: "Test Album",
  artist: "Test Artist",
  year: 2020,
  genre: "Rock",
  coverUrl: "https://example.com/cover.jpg",
  description: "A test album",
  rating: 4.2,
  featured: false,
};

const TRACK: Track = {
  id: "test-album-track-1",
  albumId: "test-album",
  title: "Track One",
  position: 1,
  durationSec: 200,
};

describe("AlbumRepository – albums", () => {
  let repo: AlbumRepository;

  beforeEach(() => {
    repo = new AlbumRepository();
    repo.reset([ALBUM], [TRACK]);
  });

  it("lists all albums", () => {
    const page = repo.listAlbums({ page: 1, pageSize: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
    expect(page.totalPages).toBe(1);
  });

  it("returns correct page slice", () => {
    repo.reset(
      Array.from({ length: 25 }, (_, i) => ({
        ...ALBUM,
        id: `album-${i}`,
        title: `Album ${i}`,
      })),
    );
    const page = repo.listAlbums({ page: 2, pageSize: 10 });
    expect(page.items).toHaveLength(10);
    expect(page.page).toBe(2);
    expect(page.total).toBe(25);
    expect(page.totalPages).toBe(3);
  });

  it("filters by search term (title)", () => {
    repo.reset([
      ALBUM,
      { ...ALBUM, id: "other", title: "Other Album", artist: "Nobody" },
    ]);
    const page = repo.listAlbums({ page: 1, pageSize: 20, search: "test" });
    expect(page.items.every((a) => a.title.toLowerCase().includes("test"))).toBe(true);
  });

  it("filters by genre", () => {
    repo.reset([
      ALBUM,
      { ...ALBUM, id: "pop-album", title: "Pop Album", genre: "Pop" },
    ]);
    const page = repo.listAlbums({ page: 1, pageSize: 20, genre: "Rock" });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].genre).toBe("Rock");
  });

  it("sorts by year ascending", () => {
    repo.reset([
      { ...ALBUM, id: "b", year: 2000 },
      { ...ALBUM, id: "a", year: 1990 },
    ]);
    const page = repo.listAlbums({ page: 1, pageSize: 20, sort: "year", order: "asc" });
    expect(page.items[0].year).toBe(1990);
    expect(page.items[1].year).toBe(2000);
  });

  it("gets an album by id", () => {
    const album = repo.getAlbum("test-album");
    expect(album).toBeDefined();
    expect(album?.title).toBe("Test Album");
  });

  it("returns undefined for missing album", () => {
    expect(repo.getAlbum("does-not-exist")).toBeUndefined();
  });

  it("creates an album", () => {
    const before = repo.listAlbums({ page: 1, pageSize: 100 }).total;
    const created = repo.createAlbum({
      title: "New Album",
      artist: "New Artist",
      year: 2024,
      genre: "Jazz",
      coverUrl: "https://example.com/new.jpg",
      description: "",
      rating: 3,
      featured: false,
    });
    expect(created.id).toBe("new-album");
    expect(repo.listAlbums({ page: 1, pageSize: 100 }).total).toBe(before + 1);
  });

  it("generates unique id when slug already taken", () => {
    // SEED already owns "test-album"; the next creation with the same title gets "-1"
    const second = repo.createAlbum({
      title: "Test Album",
      artist: "Someone",
      year: 2022,
      genre: "Pop",
      coverUrl: "https://example.com/c.jpg",
      description: "",
      rating: 3,
      featured: false,
    });
    expect(second.id).toBe("test-album-1");
  });

  it("updates an album", () => {
    const updated = repo.updateAlbum("test-album", { title: "Updated Title" });
    expect(updated?.title).toBe("Updated Title");
    expect(repo.getAlbum("test-album")?.title).toBe("Updated Title");
  });

  it("returns undefined when updating missing album", () => {
    expect(repo.updateAlbum("no-such-id", { title: "x" })).toBeUndefined();
  });

  it("deletes an album and its tracks", () => {
    const result = repo.deleteAlbum("test-album");
    expect(result).toBe(true);
    expect(repo.getAlbum("test-album")).toBeUndefined();
    expect(repo.listTracksByAlbum("test-album")).toHaveLength(0);
  });

  it("returns false deleting a non-existent album", () => {
    expect(repo.deleteAlbum("ghost")).toBe(false);
  });
});

describe("AlbumRepository – tracks", () => {
  let repo: AlbumRepository;

  beforeEach(() => {
    repo = new AlbumRepository();
    repo.reset([ALBUM], [TRACK]);
  });

  it("lists tracks for an album sorted by position", () => {
    repo.reset(
      [ALBUM],
      [
        { ...TRACK, id: "t3", position: 3 },
        { ...TRACK, id: "t1", position: 1 },
        { ...TRACK, id: "t2", position: 2 },
      ],
    );
    const tracks = repo.listTracksByAlbum("test-album");
    expect(tracks.map((t) => t.position)).toEqual([1, 2, 3]);
  });

  it("gets a track by id", () => {
    const track = repo.getTrack("test-album-track-1");
    expect(track?.title).toBe("Track One");
  });

  it("returns undefined for missing track", () => {
    expect(repo.getTrack("ghost")).toBeUndefined();
  });

  it("creates a track", () => {
    const track = repo.createTrack("test-album", {
      title: "New Track",
      position: 2,
      durationSec: 180,
    });
    expect(track).toBeDefined();
    expect(track?.albumId).toBe("test-album");
    expect(repo.listTracksByAlbum("test-album")).toHaveLength(2);
  });

  it("returns undefined creating track for missing album", () => {
    expect(repo.createTrack("ghost-album", { title: "x", position: 1, durationSec: 60 })).toBeUndefined();
  });

  it("updates a track", () => {
    const updated = repo.updateTrack("test-album-track-1", { title: "Renamed" });
    expect(updated?.title).toBe("Renamed");
  });

  it("deletes a track", () => {
    const removed = repo.deleteTrack("test-album-track-1");
    expect(removed?.id).toBe("test-album-track-1");
    expect(repo.listTracksByAlbum("test-album")).toHaveLength(0);
  });

  it("returns undefined deleting missing track", () => {
    expect(repo.deleteTrack("ghost")).toBeUndefined();
  });

  it("generates a unique track id with random suffix when base id is already taken", () => {
    // Pre-seed a track whose id matches the slug that would be generated for title "dupe"
    // albumId="test-album", slugify("dupe")="dupe" → base="test-album-dupe"
    repo.reset(
      [ALBUM],
      [{ id: "test-album-dupe", albumId: "test-album", title: "dupe", position: 1, durationSec: 100 }],
    );
    // Creating a second track with the same title triggers the randomSuffix path
    const track = repo.createTrack("test-album", { title: "dupe", position: 2, durationSec: 100 });
    expect(track).toBeDefined();
    expect(track?.id).toMatch(/^test-album-dupe-.+$/);
  });

  it("returns 0 when compared values are equal in sort", () => {
    // Two albums with identical sort key — comparator must return 0 for at least one pair
    repo.reset([
      { ...ALBUM, id: "a1", year: 2000 },
      { ...ALBUM, id: "a2", year: 2000 },
    ]);
    const page = repo.listAlbums({ page: 1, pageSize: 20, sort: "year", order: "asc" });
    expect(page.items).toHaveLength(2);
    expect(page.items.every((a) => a.year === 2000)).toBe(true);
  });
});
