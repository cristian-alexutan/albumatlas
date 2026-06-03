import type { Album } from "@/lib/api-client";

export const PAGE_SIZE = 20;

export type BrowseData = {
  featuredAlbums: Album[];
  visibleAlbums: Album[];
  showingFrom: number;
  showingTo: number;
  filteredCount: number;
  pageNumbers: number[];
  currentPage: number;
  totalPages: number;
  previousPage: number;
  nextPage: number;
  buildPageLink: (page: number) => string;
};

export function getPageButtonClass(pageNumber: number, currentPage: number): string {
  if (pageNumber === currentPage) {
    return "border px-4 py-2 border-zinc-700 bg-zinc-700 text-zinc-100";
  }
  return "border px-4 py-2 border-zinc-300 bg-white text-zinc-700";
}

/** Used by tests that still pass albums directly */
export function getBrowseData(
  albums: Album[],
  qFromUrl: string,
  pageFromUrl: string | null,
): BrowseData {
  const query = qFromUrl.trim().toLowerCase();
  const pageNumber = Number(pageFromUrl || "1");
  const requestedPage = pageNumber > 0 ? pageNumber : 1;

  const filteredAlbums = albums.filter((album) => {
    if (!query) return true;
    return (
      album.title.toLowerCase().includes(query) ||
      album.artist.toLowerCase().includes(query) ||
      album.genre.toLowerCase().includes(query)
    );
  });

  const featuredAlbums = albums.filter((a) => a.featured).slice(0, 3);
  const totalPages = Math.max(1, Math.ceil(filteredAlbums.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleAlbums = filteredAlbums.slice(startIndex, startIndex + PAGE_SIZE);

  const showingFrom = filteredAlbums.length === 0 ? 0 : startIndex + 1;
  const showingTo =
    filteredAlbums.length === 0 ? 0 : startIndex + visibleAlbums.length;

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  function buildPageLink(page: number): string {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("page", String(page));
    return `/browse?${params.toString()}`;
  }

  return {
    featuredAlbums,
    visibleAlbums,
    showingFrom,
    showingTo,
    filteredCount: filteredAlbums.length,
    pageNumbers,
    currentPage,
    totalPages,
    previousPage: Math.max(1, currentPage - 1),
    nextPage: Math.min(totalPages, currentPage + 1),
    buildPageLink,
  };
}
