import { beforeEach, describe, expect, it } from "vitest";
import {
  clearQueue,
  enqueue,
  loadCachedAlbums,
  loadQueue,
  loadSyncedIdMap,
  saveCachedAlbums,
  saveSyncedIdMap,
} from "@/lib/offline-queue";
import type { Album } from "@/lib/api-client";

const album: Album = {
  id: "ok-computer",
  title: "OK Computer",
  artist: "Radiohead",
  year: 1997,
  genre: "Alternative Rock",
  coverUrl: "https://example.com/ok.jpg",
  description: "A classic",
  rating: 4.7,
  featured: true,
};

describe("offline queue storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearQueue();
    saveCachedAlbums([]);
    saveSyncedIdMap({});
  });

  it("persists only unsynced queued mutations", () => {
    enqueue({
      type: "create",
      tempId: "__offline_ok-computer",
      payload: {
        title: album.title,
        artist: album.artist,
        year: album.year,
        genre: album.genre,
        coverUrl: album.coverUrl,
        description: album.description,
        rating: album.rating,
        featured: album.featured,
      },
    });

    expect(loadQueue()).toEqual([
      expect.objectContaining({
        type: "create",
        tempId: "__offline_ok-computer",
      }),
    ]);
    expect(window.localStorage.getItem("albumatlas.offlineQueue.v2")).toContain(
      "__offline_ok-computer",
    );
  });

  it("keeps cached albums and temp-id mappings out of persistent storage", () => {
    saveCachedAlbums([album]);
    saveSyncedIdMap({ "__offline_ok-computer": "ok-computer" });

    expect(loadCachedAlbums()).toEqual([album]);
    expect(loadSyncedIdMap()).toEqual({
      "__offline_ok-computer": "ok-computer",
    });
    expect(window.localStorage.getItem("albumatlas.albumCache.v1")).toBeNull();
    expect(window.localStorage.getItem("albumatlas.syncedIdMap.v1")).toBeNull();
  });

  it("removes legacy persistent offline keys", () => {
    window.localStorage.setItem("albumatlas.offlineQueue.v1", "[]");
    window.localStorage.setItem("albumatlas.albumCache.v1", "[]");
    window.localStorage.setItem("albumatlas.syncedIdMap.v1", "{}");

    loadQueue();

    expect(window.localStorage.getItem("albumatlas.offlineQueue.v1")).toBeNull();
    expect(window.localStorage.getItem("albumatlas.albumCache.v1")).toBeNull();
    expect(window.localStorage.getItem("albumatlas.syncedIdMap.v1")).toBeNull();
  });
});
