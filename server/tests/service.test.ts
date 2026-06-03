import { describe, it, expect, beforeEach, vi } from "vitest";
import { AlbumService } from "../src/service.js";
import { AlbumRepository } from "../src/repository.js";
import { eventBus } from "../src/events.js";
import type { Album } from "../src/types.js";

const BASE_ALBUM: Album = {
  id: "svc-album",
  title: "Service Album",
  artist: "Service Artist",
  year: 2021,
  genre: "Jazz",
  coverUrl: "https://example.com/cover.jpg",
  description: "desc",
  rating: 4.0,
  featured: false,
};

describe("AlbumService", () => {
  let repo: AlbumRepository;
  let svc: AlbumService;

  beforeEach(() => {
    repo = new AlbumRepository();
    repo.reset([BASE_ALBUM], [
      { id: "t1", albumId: "svc-album", title: "T1", position: 1, durationSec: 120 },
    ]);
    svc = new AlbumService(repo);
  });

  it("listAlbums returns a page", () => {
    const page = svc.listAlbums({ page: 1, pageSize: 10 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
  });

  it("getAlbum returns existing album", () => {
    expect(svc.getAlbum("svc-album")).toMatchObject({ title: "Service Album" });
  });

  it("getAlbum returns undefined for unknown id", () => {
    expect(svc.getAlbum("unknown")).toBeUndefined();
  });

  it("createAlbum emits domain event", () => {
    const spy = vi.fn();
    const unsub = eventBus.onDomain(spy);
    svc.createAlbum({ ...BASE_ALBUM, title: "New" });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "album.created" }));
    unsub();
  });

  it("updateAlbum emits event and returns updated", () => {
    const spy = vi.fn();
    const unsub = eventBus.onDomain(spy);
    const result = svc.updateAlbum("svc-album", { title: "Updated" });
    expect(result?.title).toBe("Updated");
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "album.updated" }));
    unsub();
  });

  it("updateAlbum returns undefined for missing album", () => {
    expect(svc.updateAlbum("ghost", { title: "x" })).toBeUndefined();
  });

  it("deleteAlbum emits event and returns true", () => {
    const spy = vi.fn();
    const unsub = eventBus.onDomain(spy);
    expect(svc.deleteAlbum("svc-album")).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "album.deleted" }));
    unsub();
  });

  it("deleteAlbum returns false for missing album", () => {
    expect(svc.deleteAlbum("ghost")).toBe(false);
  });

  it("listTracks returns tracks for existing album", () => {
    const tracks = svc.listTracks("svc-album");
    expect(tracks).toHaveLength(1);
  });

  it("listTracks returns undefined for missing album", () => {
    expect(svc.listTracks("ghost")).toBeUndefined();
  });

  it("createTrack returns track and emits event", () => {
    const spy = vi.fn();
    const unsub = eventBus.onDomain(spy);
    const track = svc.createTrack("svc-album", { title: "New", position: 2, durationSec: 200 });
    expect(track).toBeDefined();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "track.created" }));
    unsub();
  });

  it("getTrack returns existing track", () => {
    expect(svc.getTrack("t1")).toMatchObject({ title: "T1" });
  });

  it("getTrack returns undefined for unknown id", () => {
    expect(svc.getTrack("ghost")).toBeUndefined();
  });

  it("updateTrack emits event and returns updated track", () => {
    const spy = vi.fn();
    const unsub = eventBus.onDomain(spy);
    const result = svc.updateTrack("t1", { title: "Updated Track" });
    expect(result?.title).toBe("Updated Track");
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "track.updated" }));
    unsub();
  });

  it("updateTrack returns undefined for missing track", () => {
    expect(svc.updateTrack("ghost", { title: "x" })).toBeUndefined();
  });

  it("createTrack returns undefined when album does not exist", () => {
    expect(svc.createTrack("ghost-album", { title: "x", position: 1, durationSec: 60 })).toBeUndefined();
  });

  it("deleteTrack returns true and emits event", () => {
    const spy = vi.fn();
    const unsub = eventBus.onDomain(spy);
    expect(svc.deleteTrack("t1")).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "track.deleted" }));
    unsub();
  });

  it("deleteTrack returns false for non-existent track", () => {
    expect(svc.deleteTrack("ghost")).toBe(false);
  });

  describe("statistics", () => {
    it("returns album count", () => {
      expect(svc.statistics().albumCount).toBe(1);
    });

    it("returns average rating", () => {
      expect(svc.statistics().averageRating).toBe(4.0);
    });

    it("aggregates by genre", () => {
      const stats = svc.statistics();
      expect(stats.byGenre).toEqual([{ genre: "Jazz", albumCount: 1 }]);
    });

    it("aggregates by decade", () => {
      const stats = svc.statistics();
      expect(stats.byDecade).toEqual([{ decade: "2020s", albumCount: 1 }]);
    });

    it("handles empty repository", () => {
      repo.reset([]);
      const stats = svc.statistics();
      expect(stats.albumCount).toBe(0);
      expect(stats.averageRating).toBe(0);
      expect(stats.topRated).toHaveLength(0);
    });
  });
});
