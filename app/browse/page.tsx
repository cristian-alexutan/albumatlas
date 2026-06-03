"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/components/auth-provider";
import { useAlbums } from "@/app/components/albums-provider";
import { SiteHeader } from "@/app/components/site-header";
import { fetchAlbumsPage } from "@/lib/api-client";
import { loadQueue, loadSyncedIdMap } from "@/lib/offline-queue";
import type { Album } from "@/lib/api-client";

const PAGE_SIZE = 20;

function albumMatchesSearch(album: Album, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return (
    album.title.toLowerCase().includes(normalized) ||
    album.artist.toLowerCase().includes(normalized) ||
    album.genre.toLowerCase().includes(normalized)
  );
}

function sameAlbumOrder(a: Album[], b: Album[]): boolean {
  return a.length === b.length && a.every((album, index) => album.id === b[index]?.id);
}

function uniqueAlbumsById(albums: Album[]): Album[] {
  const seen = new Set<string>();
  return albums.filter((album) => {
    if (seen.has(album.id)) return false;
    seen.add(album.id);
    return true;
  });
}

function BrowsePageContent() {
  const { currentUser } = useAuth();
  const {
    albums: localAlbums,
    isOnline,
    isServerReachable,
  } = useAlbums();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") || "";

  const [visibleAlbums, setVisibleAlbums] = useState<Album[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [search, setSearch] = useState(qFromUrl);
  const prefetchedRef = useRef<Album[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousLocalAlbumIdsRef = useRef<Set<string> | null>(null);

  // Keep a ref so the catch-fallback in loadPage always sees the latest
  // localAlbums without making loadPage depend on it (which causes infinite
  // re-renders when the mock returns a new array reference every render).
  const localAlbumsRef = useRef<Album[]>(localAlbums);
  localAlbumsRef.current = localAlbums;

  const featuredAlbums = localAlbums.filter((a) => a.featured).slice(0, 3);

  const showLocalAlbums = useCallback((query: string) => {
    const fallback = localAlbumsRef.current.filter((album) =>
      albumMatchesSearch(album, query),
    );

    setVisibleAlbums(fallback);
    setPage(1);
    setTotalPages(1);
  }, []);

  const mergeLocalOfflineAlbums = useCallback((items: Album[], query: string) => {
    const queue = loadQueue();
    const syncedIdMap = loadSyncedIdMap();
    const syncedTempIds = new Set(Object.keys(syncedIdMap));
    const deletedIds = new Set(
      queue.filter((op) => op.type === "delete").map((op) => op.id),
    );
    const localAlbumsById = new Map(
      localAlbumsRef.current.map((album) => [album.id, album]),
    );
    const overrideIds = new Set<string>(Object.values(syncedIdMap));

    for (const op of queue) {
      if (op.type === "create") overrideIds.add(op.tempId);
      if (op.type === "update") overrideIds.add(op.id);
    }

    const filteredItems = items
      .filter((album) => !deletedIds.has(album.id) && !syncedTempIds.has(album.id))
      .map((album) =>
        overrideIds.has(album.id) ? localAlbumsById.get(album.id) ?? album : album,
      );
    const visibleIds = new Set(filteredItems.map((album) => album.id));

    const localAdditions = localAlbumsRef.current.filter(
      (album) =>
        overrideIds.has(album.id) &&
        !visibleIds.has(album.id) &&
        albumMatchesSearch(album, query),
    );

    return localAdditions.length === 0 ? filteredItems : [...localAdditions, ...filteredItems];
  }, []);

  // ── initial / search fetch ────────────────────────────────────────────────

  const loadPage = useCallback(
    async (pageNum: number, query: string, append: boolean) => {
      if (pageNum === 1) setIsFetching(true);
      else setIsLoadingMore(true);

      try {
        // Check if we already prefetched this page
        let items: Album[];
        let fetchedTotalPages: number;

        if (append && prefetchedRef.current.length > 0 && pageNum > 1) {
          items = prefetchedRef.current;
          prefetchedRef.current = [];
          const infoRes = await fetchAlbumsPage({ page: pageNum, pageSize: PAGE_SIZE, search: query || undefined });
          fetchedTotalPages = infoRes.totalPages;
          items = infoRes.items; // re-use fresh data
        } else {
          const res = await fetchAlbumsPage({
            page: pageNum,
            pageSize: PAGE_SIZE,
            search: query || undefined,
          });
          items = res.items;
          fetchedTotalPages = res.totalPages;
        }

        setVisibleAlbums((prev) =>
          mergeLocalOfflineAlbums(append ? [...prev, ...items] : items, query),
        );
        setPage(pageNum);
        setTotalPages(fetchedTotalPages);

        // Prefetch next page
        if (pageNum < fetchedTotalPages) {
          fetchAlbumsPage({
            page: pageNum + 1,
            pageSize: PAGE_SIZE,
            search: query || undefined,
          }).then((next) => {
            prefetchedRef.current = next.items;
          }).catch(() => { /* ignore prefetch errors */ });
        }
      } catch {
        // server down — fall back to local albums (via ref so loadPage stays stable)
        showLocalAlbums(query);
      } finally {
        setIsFetching(false);
        setIsLoadingMore(false);
      }
    },
    [mergeLocalOfflineAlbums, showLocalAlbums],
  );

  // Reset and reload when search changes
  useEffect(() => {
    prefetchedRef.current = [];
    setVisibleAlbums([]);
    loadPage(1, search, false);
  }, [search, loadPage]);

  useEffect(() => {
    if (isOnline && isServerReachable) return;
    showLocalAlbums(search);
    setIsFetching(false);
    setIsLoadingMore(false);
  }, [isOnline, isServerReachable, localAlbums, search, showLocalAlbums]);

  useEffect(() => {
    if (!isOnline || !isServerReachable) return;

    setVisibleAlbums((current) => {
      const merged = mergeLocalOfflineAlbums(current, search);
      return sameAlbumOrder(current, merged) ? current : merged;
    });
  }, [isOnline, isServerReachable, localAlbums, mergeLocalOfflineAlbums, search]);

  useEffect(() => {
    const currentIds = new Set(localAlbums.map((album) => album.id));
    const previousIds = previousLocalAlbumIdsRef.current;
    previousLocalAlbumIdsRef.current = currentIds;

    if (!isOnline || !isServerReachable || !previousIds || previousIds.size === 0) {
      return;
    }

    const newlyCreatedAlbums = localAlbums.filter(
      (album) => !previousIds.has(album.id) && albumMatchesSearch(album, search),
    );

    if (newlyCreatedAlbums.length === 0) return;

    setVisibleAlbums((current) => {
      const syncedTempIds = new Set(Object.keys(loadSyncedIdMap()));
      return uniqueAlbumsById([...newlyCreatedAlbums, ...current]).filter(
        (album) => !syncedTempIds.has(album.id),
      );
    });
    setTotalPages((current) =>
      Math.max(current, Math.ceil((visibleAlbums.length + newlyCreatedAlbums.length) / PAGE_SIZE)),
    );
  }, [isOnline, isServerReachable, localAlbums, search, visibleAlbums.length]);

  // ── Intersection Observer for infinite scroll ─────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && page < totalPages) {
          loadPage(page + 1, search, true);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isLoadingMore, page, totalPages, search, loadPage]);

  // ── debounced search input ────────────────────────────────────────────────

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 300);
  }

  const canManageAlbums = currentUser?.role === "admin";

  return (
    <div className="min-h-screen bg-zinc-100">
      <SiteHeader />

      <main className="mx-auto max-w-[1680px] px-6 py-10">
        <div className="page-enter">
          {/* Featured */}
          {featuredAlbums.length > 0 && (
            <section className="border border-zinc-300 bg-zinc-100 p-6 mb-10">
              <h1 className="mb-6 text-center text-2xl font-medium text-zinc-800">
                Featured Albums
              </h1>
              <div className="grid gap-6 lg:grid-cols-3">
                {featuredAlbums.map((album) => (
                  <article
                    key={album.id}
                    className="card-hover border border-zinc-300 bg-zinc-100 p-4"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={album.coverUrl}
                      alt={`${album.title} cover`}
                      className="aspect-square w-full border border-zinc-200 bg-white object-contain"
                    />
                    <h2 className="mt-3 text-xl font-medium text-zinc-800">{album.title}</h2>
                    <p className="mt-1 text-base text-zinc-600">{album.artist}</p>
                    <p className="mt-3 text-base text-zinc-600">★ {album.rating.toFixed(1)}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Table */}
          <section>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-medium text-zinc-800">Album Database</h2>
              {canManageAlbums && (
                <Link
                  href="/albums/new"
                  className="bg-zinc-700 px-5 py-2.5 text-base font-medium text-zinc-100 transition-colors hover:bg-zinc-800"
                >
                  Add Album
                </Link>
              )}
            </div>

            <div className="mb-4 max-w-2xl">
              <input
                type="search"
                defaultValue={qFromUrl}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by album or artist…"
                className="h-11 w-full border border-zinc-300 bg-white px-4 text-sm text-zinc-700 outline-none focus:border-zinc-500"
              />
            </div>

            {isFetching ? (
              <p className="py-12 text-center text-zinc-500">Loading albums…</p>
            ) : (
              <>
                <div className="overflow-x-auto border border-zinc-300 bg-zinc-100">
                  <table className="w-full min-w-[860px] text-left">
                    <thead className="border-b border-zinc-300 text-base text-zinc-800">
                      <tr>
                        <th className="px-5 py-4 font-medium">Cover</th>
                        <th className="px-5 py-4 font-medium">Album Name</th>
                        <th className="px-5 py-4 font-medium">Artist</th>
                        <th className="px-5 py-4 font-medium">Year</th>
                        <th className="px-5 py-4 font-medium">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAlbums.map((album) => (
                        <tr
                          key={album.id}
                          className="border-b border-zinc-200 text-sm text-zinc-700 transition-colors hover:bg-white md:text-base"
                        >
                          <td className="px-5 py-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={album.coverUrl}
                              alt={`${album.title} cover`}
                              className="h-14 w-14 object-cover"
                            />
                          </td>
                          <td className="px-5 py-3">
                            <Link href={`/albums/${album.id}`} className="hover:underline">
                              {album.title}
                            </Link>
                          </td>
                          <td className="px-5 py-3">{album.artist}</td>
                          <td className="px-5 py-3">{album.year}</td>
                          <td className="px-5 py-3">{album.rating.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end text-sm text-zinc-600">
                  {page < totalPages && !isLoadingMore && (
                    <button
                      type="button"
                      onClick={() => loadPage(page + 1, search, true)}
                      className="border border-zinc-300 bg-white px-4 py-2 text-zinc-700 hover:bg-zinc-50"
                    >
                      Load more
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-4" />

            {isLoadingMore && (
              <p className="py-6 text-center text-zinc-500">Loading more…</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-100" />}>
      <BrowsePageContent />
    </Suspense>
  );
}
