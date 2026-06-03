"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as api from "@/lib/api-client";
import {
  clearQueue,
  enqueue,
  loadCachedAlbums,
  loadQueue,
  loadSyncedIdMap,
  saveCachedAlbums,
  saveQueue,
  saveSyncedIdMap,
  type QueuedOp,
} from "@/lib/offline-queue";
import type { Album } from "@/lib/api-client";

export type { Album };

export type AlbumMutation = {
  title: string;
  artist: string;
  year: number;
  genre: string;
  coverUrl: string;
  description: string;
  rating?: number;
  tracks?: string[];
  featured?: boolean;
};

type AlbumsContextValue = {
  albums: Album[];
  isOnline: boolean;
  isServerReachable: boolean;
  isSyncing: boolean;
  isLoading: boolean;
  getAlbumById: (id: string) => Album | undefined;
  createAlbum: (payload: AlbumMutation) => Promise<Album>;
  updateAlbum: (id: string, payload: AlbumMutation) => Promise<Album | undefined>;
  deleteAlbum: (id: string) => Promise<boolean>;
  refreshAlbums: () => Promise<void>;
};

const AlbumsContext = createContext<AlbumsContextValue | null>(null);

function mutationToInput(payload: AlbumMutation): api.AlbumInput {
  return {
    title: payload.title,
    artist: payload.artist,
    year: payload.year,
    genre: payload.genre,
    coverUrl: payload.coverUrl,
    description: payload.description,
    rating: payload.rating ?? 0,
    featured: payload.featured ?? false,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function isTempAlbumId(id: string): boolean {
  return id.startsWith("__offline_");
}

function hasBrowserNetwork(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function shouldQueueMutation(error: unknown): boolean {
  return !(error instanceof api.ApiError);
}

function buildTempId(title: string, albums: Album[]): string {
  const base = `__offline_${slugify(title) || "album"}`;
  const usedIds = new Set(albums.map((album) => album.id));

  for (const op of loadQueue()) {
    if (op.type === "create") usedIds.add(op.tempId);
    else usedIds.add(op.id);
  }

  if (!usedIds.has(base)) return base;

  let i = 1;
  while (usedIds.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

function applyPendingQueue(baseAlbums: Album[], queue: QueuedOp[]): Album[] {
  const albums = [...baseAlbums];

  for (const op of queue) {
    if (op.type === "create") {
      const tempAlbum = { id: op.tempId, ...op.payload };
      const existingIndex = albums.findIndex((album) => album.id === op.tempId);
      if (existingIndex >= 0) albums[existingIndex] = tempAlbum;
      else albums.push(tempAlbum);
      continue;
    }

    if (op.type === "update") {
      const existingIndex = albums.findIndex((album) => album.id === op.id);
      if (existingIndex >= 0) {
        albums[existingIndex] = { ...albums[existingIndex], ...op.payload };
      }
      continue;
    }

    const deleteIndex = albums.findIndex((album) => album.id === op.id);
    if (deleteIndex >= 0) albums.splice(deleteIndex, 1);
  }

  return albums;
}

export function AlbumsProvider({ children }: { children: ReactNode }) {
  const [albums, setAlbums] = useState<Album[]>(() =>
    applyPendingQueue(loadCachedAlbums(), loadQueue()),
  );
  const [isOnline, setIsOnline] = useState(hasBrowserNetwork);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading] = useState(false);
  const syncInFlight = useRef(false);
  const syncQueueRef = useRef<(() => void) | null>(null);
  const syncedIdMapRef = useRef<Record<string, string>>(loadSyncedIdMap());

  const replaceAlbums = useCallback((nextAlbums: Album[]) => {
    setAlbums(nextAlbums);
    saveCachedAlbums(nextAlbums);
  }, []);

  const updateAlbums = useCallback((updater: (current: Album[]) => Album[]) => {
    setAlbums((current) => {
      const next = updater(current);
      saveCachedAlbums(next);
      return next;
    });
  }, []);

  const refreshAlbums = useCallback(async () => {
    if (!hasBrowserNetwork()) {
      replaceAlbums(applyPendingQueue(loadCachedAlbums(), loadQueue()));
      return;
    }

    try {
      const fetched = await api.fetchAllAlbums();
      const merged = applyPendingQueue(fetched, loadQueue());

      replaceAlbums(merged);
      setIsServerReachable((wasReachable) => {
        if (!wasReachable) setTimeout(() => syncQueueRef.current?.(), 0);
        return true;
      });
    } catch {
      replaceAlbums(applyPendingQueue(loadCachedAlbums(), loadQueue()));
      setIsServerReachable(false);
    }
  }, [replaceAlbums]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshAlbums();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshAlbums]);

  const syncQueue = useCallback(async () => {
    if (syncInFlight.current || !hasBrowserNetwork()) return;

    const queue = loadQueue();
    if (queue.length === 0) return;

    syncInFlight.current = true;
    setIsSyncing(true);

    const remaining: QueuedOp[] = [];
    const idMap = { ...syncedIdMapRef.current, ...loadSyncedIdMap() };

    for (let index = 0; index < queue.length; index++) {
      const op = queue[index];

      try {
        if (op.type === "create") {
          const created = await api.createAlbum(op.payload);
          idMap[op.tempId] = created.id;
          syncedIdMapRef.current = idMap;
          saveSyncedIdMap(idMap);
          updateAlbums((current) =>
            current.map((album) => (album.id === op.tempId ? created : album)),
          );
          saveQueue(queue.slice(index + 1));
          continue;
        }

        if (op.type === "update") {
          const targetId = idMap[op.id] ?? op.id;
          const updated = await api.updateAlbum(targetId, op.payload);
          updateAlbums((current) =>
            current.map((album) =>
              album.id === op.id || album.id === targetId ? updated : album,
            ),
          );
          saveQueue(queue.slice(index + 1));
          continue;
        }

        const targetId = idMap[op.id] ?? op.id;
        await api.deleteAlbum(targetId);
        updateAlbums((current) =>
          current.filter((album) => album.id !== op.id && album.id !== targetId),
        );
        saveQueue(queue.slice(index + 1));
      } catch {
        remaining.push(op, ...queue.slice(index + 1));
        break;
      }
    }

    if (remaining.length === 0) clearQueue();
    else saveQueue(remaining);

    await refreshAlbums();
    syncInFlight.current = false;
    setIsSyncing(false);
  }, [refreshAlbums, updateAlbums]);

  useEffect(() => {
    syncQueueRef.current = syncQueue;
  }, [syncQueue]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      refreshAlbums().then(syncQueue);
    }

    function handleOffline() {
      setIsOnline(false);
      replaceAlbums(applyPendingQueue(loadCachedAlbums(), loadQueue()));
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshAlbums, replaceAlbums, syncQueue]);

  useEffect(() => {
    if (!isOnline || isServerReachable) return;

    const intervalId = setInterval(() => {
      refreshAlbums();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isOnline, isServerReachable, refreshAlbums]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    function connect() {
      if (!hasBrowserNetwork()) return;

      const wsUrl = api.API_BASE
        ? api.API_BASE.replace(/^http/, "ws") + "/ws"
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        refreshAlbums();
      };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string);
          if (
            event.type === "album.created" ||
            event.type === "album.updated" ||
            event.type === "album.deleted" ||
            event.type === "generator.started"
          ) {
            refreshAlbums();
          }
        } catch {
          // Ignore malformed socket messages.
        }
      };

      ws.onclose = () => {
        if (!closed) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [refreshAlbums]);

  const getAlbumById = useCallback(
    (id: string) => {
      const mappedId = syncedIdMapRef.current[id] ?? id;
      return albums.find((album) => album.id === id || album.id === mappedId);
    },
    [albums],
  );

  const markServerUnreachable = useCallback(() => {
    setIsServerReachable(false);
  }, []);

  const createAlbum = useCallback(
    async (payload: AlbumMutation): Promise<Album> => {
      const input = mutationToInput(payload);

      function queueCreate(): Album {
        const tempAlbum: Album = {
          ...input,
          id: buildTempId(input.title, albums),
        };

        updateAlbums((current) => [...current, tempAlbum]);
        enqueue({ type: "create", tempId: tempAlbum.id, payload: input });
        return tempAlbum;
      }

      if (!hasBrowserNetwork() || !isServerReachable) return queueCreate();

      try {
        const created = await api.createAlbum(input);
        updateAlbums((current) => [...current, created]);
        return created;
      } catch (error) {
        if (!shouldQueueMutation(error)) throw error;
        markServerUnreachable();
        return queueCreate();
      }
    },
    [albums, isServerReachable, markServerUnreachable, updateAlbums],
  );

  const updateAlbum = useCallback(
    async (id: string, payload: AlbumMutation): Promise<Album | undefined> => {
      const patch = mutationToInput(payload);
      const resolvedId = syncedIdMapRef.current[id] ?? id;
      const currentAlbum = albums.find(
        (album) => album.id === id || album.id === resolvedId,
      );
      const optimisticAlbum = currentAlbum
        ? ({ ...currentAlbum, ...patch } as Album)
        : undefined;

      function queueUpdate(): Album | undefined {
        updateAlbums((current) =>
          current.map((album) =>
            album.id === id || album.id === resolvedId
              ? { ...album, ...patch }
              : album,
          ),
        );

        const queue = loadQueue();
        if (isTempAlbumId(id)) {
          const createIndex = queue.findIndex(
            (op) => op.type === "create" && op.tempId === id,
          );
          if (createIndex >= 0) {
            const createOp = queue[createIndex] as Extract<QueuedOp, { type: "create" }>;
            const next = [...queue];
            next[createIndex] = {
              ...createOp,
              payload: { ...createOp.payload, ...patch },
            };
            saveQueue(next);
            return optimisticAlbum;
          }
        }

        enqueue({ type: "update", id: resolvedId, payload: patch });
        return optimisticAlbum;
      }

      if (!hasBrowserNetwork() || !isServerReachable) return queueUpdate();

      try {
        const updated = await api.updateAlbum(resolvedId, patch);
        updateAlbums((current) =>
          current.map((album) =>
            album.id === id || album.id === resolvedId ? updated : album,
          ),
        );
        return updated;
      } catch (error) {
        if (!shouldQueueMutation(error)) throw error;
        markServerUnreachable();
        return queueUpdate();
      }
    },
    [albums, isServerReachable, markServerUnreachable, updateAlbums],
  );

  const deleteAlbum = useCallback(
    async (id: string): Promise<boolean> => {
      const resolvedId = syncedIdMapRef.current[id] ?? id;

      function queueDelete(): boolean {
        updateAlbums((current) =>
          current.filter((album) => album.id !== id && album.id !== resolvedId),
        );

        const queue = loadQueue();
        if (isTempAlbumId(id)) {
          const next = queue.filter(
            (op) =>
              !((op.type === "create" && op.tempId === id) ||
                (op.type !== "create" && op.id === id)),
          );
          saveQueue(next);
          return true;
        }

        enqueue({ type: "delete", id: resolvedId });
        return true;
      }

      if (!hasBrowserNetwork() || !isServerReachable) return queueDelete();

      try {
        const ok = await api.deleteAlbum(resolvedId);
        if (ok) {
          updateAlbums((current) =>
            current.filter((album) => album.id !== id && album.id !== resolvedId),
          );
        }
        return ok;
      } catch (error) {
        if (!shouldQueueMutation(error)) throw error;
        markServerUnreachable();
        return queueDelete();
      }
    },
    [isServerReachable, markServerUnreachable, updateAlbums],
  );

  return (
    <AlbumsContext.Provider
      value={{
        albums,
        isOnline,
        isServerReachable,
        isSyncing,
        isLoading,
        getAlbumById,
        createAlbum,
        updateAlbum,
        deleteAlbum,
        refreshAlbums,
      }}
    >
      {children}
    </AlbumsContext.Provider>
  );
}

export function useAlbums(): AlbumsContextValue {
  const context = useContext(AlbumsContext);
  if (!context) throw new Error("useAlbums must be used within AlbumsProvider.");
  return context;
}
