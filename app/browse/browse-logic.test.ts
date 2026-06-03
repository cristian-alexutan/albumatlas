import { getBrowseData, getPageButtonClass } from "@/app/browse/browse-logic";
import type { Album } from "@/lib/types";

function makeAlbum(id: string, title: string, artist: string, genre: string, featured = false): Album {
  return {
    id,
    title,
    artist,
    year: 2000,
    genre,
    coverUrl: "https://example.com/cover.jpg",
    description: "desc",
    rating: 4,
    tracks: ["Song"],
    featured,
  };
}

const albums: Album[] = [
  makeAlbum("a1", "First", "Alpha", "Rock", true),
  makeAlbum("a2", "Second", "Beta", "Pop", true),
  makeAlbum("a3", "Third", "Gamma", "Jazz", true),
  makeAlbum("a4", "Fourth", "Delta", "Rock", true),
  makeAlbum("a5", "Fifth", "Echo", "Hip Hop"),
  makeAlbum("a6", "Sixth", "Foxtrot", "Rock"),
  makeAlbum("a7", "Seventh", "Blood Orange", "Alternative R&B"),
];

describe("browse logic", () => {
  it("returns active page class for current page button", () => {
    expect(getPageButtonClass(2, 2)).toContain("border-zinc-700");
    expect(getPageButtonClass(1, 2)).toContain("border-zinc-300");
  });

  it("filters albums by query and keeps only first 3 featured albums", () => {
    const data = getBrowseData(albums, "blood", "1");

    expect(data.filteredCount).toBe(1);
    expect(data.visibleAlbums[0]?.id).toBe("a7");
    expect(data.featuredAlbums).toHaveLength(3);
    expect(data.featuredAlbums.map((album) => album.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("paginates and clamps current page when page is too large", () => {
    const data = getBrowseData(albums, "", "999");

    expect(data.totalPages).toBe(1);
    expect(data.currentPage).toBe(1);
    expect(data.visibleAlbums).toHaveLength(7);
    expect(data.showingFrom).toBe(1);
    expect(data.showingTo).toBe(7);
  });

  it("returns empty-state counters for no results and keeps one page", () => {
    const data = getBrowseData(albums, "no-match", "1");

    expect(data.filteredCount).toBe(0);
    expect(data.totalPages).toBe(1);
    expect(data.currentPage).toBe(1);
    expect(data.showingFrom).toBe(0);
    expect(data.showingTo).toBe(0);
    expect(data.visibleAlbums).toHaveLength(0);
  });

  it("builds links with normalized query and target page", () => {
    const data = getBrowseData(albums, "  RoCk  ", "1");

    expect(data.buildPageLink(2)).toBe("/browse?q=rock&page=2");
  });

  it("handles missing or invalid page values and omits q when query is empty", () => {
    const dataFromNullPage = getBrowseData(albums, "", null);
    expect(dataFromNullPage.currentPage).toBe(1);
    expect(dataFromNullPage.buildPageLink(3)).toBe("/browse?page=3");

    const dataFromInvalidPage = getBrowseData(albums, "", "-10");
    expect(dataFromInvalidPage.currentPage).toBe(1);
  });
});


