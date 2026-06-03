import type { Album, AlbumInput } from "./api-client";

export type QueuedOp =
  | { type: "create"; tempId: string; payload: AlbumInput }
  | { type: "update"; id: string; payload: Partial<AlbumInput> }
  | { type: "delete"; id: string };

const LEGACY_STORAGE_KEYS = [
  "albumatlas.offlineQueue.v1",
  "albumatlas.albumCache.v1",
  "albumatlas.syncedIdMap.v1",
];
const QUEUE_KEY = "albumatlas.offlineQueue.v2";

let inMemoryQueue: QueuedOp[] = [];
let inMemoryAlbums: Album[] = [];
let inMemoryIdMap: Record<string, string> = {};

function clearLegacyPersistentStorage(): void {
  if (typeof window === "undefined") return;

  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage access failures; this module now uses RAM only.
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readQueueFromStorage(): QueuedOp[] {
  const storage = getStorage();
  if (!storage) return inMemoryQueue;

  try {
    const raw = storage.getItem(QUEUE_KEY);
    if (!raw) return inMemoryQueue;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedOp[]) : [];
  } catch {
    return inMemoryQueue;
  }
}

function writeQueueToStorage(queue: QueuedOp[]): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    if (queue.length === 0) storage.removeItem(QUEUE_KEY);
    else storage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Keep the in-memory copy when storage is unavailable.
  }
}

export function loadQueue(): QueuedOp[] {
  clearLegacyPersistentStorage();
  inMemoryQueue = readQueueFromStorage();
  return [...inMemoryQueue];
}

export function saveQueue(ops: QueuedOp[]): void {
  clearLegacyPersistentStorage();
  inMemoryQueue = [...ops];
  writeQueueToStorage(inMemoryQueue);
}

export function enqueue(op: QueuedOp): QueuedOp[] {
  clearLegacyPersistentStorage();
  inMemoryQueue = [...loadQueue(), op];
  writeQueueToStorage(inMemoryQueue);
  return loadQueue();
}

export function clearQueue(): void {
  clearLegacyPersistentStorage();
  inMemoryQueue = [];
  writeQueueToStorage(inMemoryQueue);
}

export function loadCachedAlbums(): Album[] {
  clearLegacyPersistentStorage();
  return [...inMemoryAlbums];
}

export function saveCachedAlbums(albums: Album[]): void {
  clearLegacyPersistentStorage();
  inMemoryAlbums = [...albums];
}

export function loadSyncedIdMap(): Record<string, string> {
  clearLegacyPersistentStorage();
  return { ...inMemoryIdMap };
}

export function saveSyncedIdMap(idMap: Record<string, string>): void {
  clearLegacyPersistentStorage();
  inMemoryIdMap = { ...idMap };
}
