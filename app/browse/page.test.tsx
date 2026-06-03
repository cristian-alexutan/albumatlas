import { render, screen, waitFor } from "@testing-library/react";
import BrowsePage from "@/app/browse/page";
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockProviderState = vi.hoisted(() => ({
  albums: [] as import("@/lib/api-client").Album[],
  isOnline: true,
  isServerReachable: true,
}));

const mockOfflineState = vi.hoisted(() => ({
  queue: [] as import("@/lib/offline-queue").QueuedOp[],
  idMap: {} as Record<string, string>,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("@/app/components/albums-provider", () => ({
  useAlbums: () => ({ ...mockProviderState, isSyncing: false }),
}));

vi.mock("@/app/components/auth-provider", () => ({
  useAuth: () => ({ currentUser: null }),
}));

vi.mock("@/app/components/site-header", () => ({
  SiteHeader: () => <header>header</header>,
}));

vi.mock("@/lib/api-client", () => ({
  fetchAlbumsPage: vi.fn(),
}));

vi.mock("@/lib/offline-queue", () => ({
  loadQueue: () => mockOfflineState.queue,
  loadSyncedIdMap: () => mockOfflineState.idMap,
}));

describe("BrowsePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProviderState.albums = [];
    mockProviderState.isOnline = true;
    mockProviderState.isServerReachable = true;
    mockOfflineState.queue = [];
    mockOfflineState.idMap = {};
  });

  it("shows loading state then renders albums from API", async () => {
    const { fetchAlbumsPage } = await import("@/lib/api-client");
    vi.mocked(fetchAlbumsPage).mockResolvedValue({
      items: [
        {
          id: "ok-computer",
          title: "OK Computer",
          artist: "Radiohead",
          year: 1997,
          genre: "Alternative Rock",
          coverUrl: "https://example.com/ok.jpg",
          description: "",
          rating: 4.7,
          featured: false,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    render(<BrowsePage />);

    // Initially shows loading
    expect(screen.getByText("Loading albums…")).toBeInTheDocument();

    // After fetch resolves, shows album
    await waitFor(() =>
      expect(screen.getByText("OK Computer")).toBeInTheDocument(),
    );
    expect(screen.getByText("Radiohead")).toBeInTheDocument();
  });

  it("falls back to local albums when API fails", async () => {
    const { fetchAlbumsPage } = await import("@/lib/api-client");
    vi.mocked(fetchAlbumsPage).mockRejectedValue(new Error("network error"));

    render(<BrowsePage />);

    // After failed fetch, no albums shown (local list is empty from mock)
    await waitFor(() =>
      expect(screen.queryByText("Loading albums…")).toBeNull(),
    );
    expect(screen.queryByText("OK Computer")).not.toBeInTheDocument();
  });

  it("keeps offline-created albums visible when server page does not include them yet", async () => {
    const { fetchAlbumsPage } = await import("@/lib/api-client");
    const syncedAlbum = {
      id: "offline-test-album",
      title: "Offline Test Album",
      artist: "Cached Artist",
      year: 2026,
      genre: "Rock",
      coverUrl: "https://example.com/offline.jpg",
      description: "",
      rating: 0,
      featured: false,
    };

    mockProviderState.albums = [syncedAlbum];
    mockOfflineState.idMap = {
      "__offline_offline-test-album": "offline-test-album",
    };
    vi.mocked(fetchAlbumsPage).mockResolvedValue({
      items: [
        {
          id: "ok-computer",
          title: "OK Computer",
          artist: "Radiohead",
          year: 1997,
          genre: "Alternative Rock",
          coverUrl: "https://example.com/ok.jpg",
          description: "",
          rating: 4.7,
          featured: false,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });

    render(<BrowsePage />);

    await waitFor(() =>
      expect(screen.getByText("Offline Test Album")).toBeInTheDocument(),
    );
    expect(screen.getByText("OK Computer")).toBeInTheDocument();
  });

  it("hides offline-deleted albums even when the server page is stale", async () => {
    const { fetchAlbumsPage } = await import("@/lib/api-client");

    mockOfflineState.queue = [{ type: "delete", id: "ok-computer" }];
    vi.mocked(fetchAlbumsPage).mockResolvedValue({
      items: [
        {
          id: "ok-computer",
          title: "OK Computer",
          artist: "Radiohead",
          year: 1997,
          genre: "Alternative Rock",
          coverUrl: "https://example.com/ok.jpg",
          description: "",
          rating: 4.7,
          featured: false,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    render(<BrowsePage />);

    await waitFor(() =>
      expect(screen.queryByText("Loading albumsâ€¦")).toBeNull(),
    );
    expect(screen.queryByText("OK Computer")).not.toBeInTheDocument();
  });

  it("shows offline-updated album data even when the server page is stale", async () => {
    const { fetchAlbumsPage } = await import("@/lib/api-client");

    mockProviderState.albums = [
      {
        id: "ok-computer",
        title: "OK Computer Updated Offline",
        artist: "Radiohead",
        year: 1997,
        genre: "Alternative Rock",
        coverUrl: "https://example.com/ok.jpg",
        description: "",
        rating: 4.7,
        featured: false,
      },
    ];
    mockOfflineState.queue = [
      {
        type: "update",
        id: "ok-computer",
        payload: { title: "OK Computer Updated Offline" },
      },
    ];
    vi.mocked(fetchAlbumsPage).mockResolvedValue({
      items: [
        {
          id: "ok-computer",
          title: "OK Computer",
          artist: "Radiohead",
          year: 1997,
          genre: "Alternative Rock",
          coverUrl: "https://example.com/ok.jpg",
          description: "",
          rating: 4.7,
          featured: false,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    render(<BrowsePage />);

    await waitFor(() =>
      expect(screen.getByText("OK Computer Updated Offline")).toBeInTheDocument(),
    );
    expect(screen.queryByText("OK Computer")).not.toBeInTheDocument();
  });

  it("adds newly generated server albums when provider state updates", async () => {
    const { fetchAlbumsPage } = await import("@/lib/api-client");
    const okComputer = {
      id: "ok-computer",
      title: "OK Computer",
      artist: "Radiohead",
      year: 1997,
      genre: "Alternative Rock",
      coverUrl: "https://example.com/ok.jpg",
      description: "",
      rating: 4.7,
      featured: false,
    };
    const generatedAlbum = {
      id: "generated-album",
      title: "Generated Album",
      artist: "Generator",
      year: 2026,
      genre: "Electronic",
      coverUrl: "https://example.com/generated.jpg",
      description: "",
      rating: 3.7,
      featured: false,
    };

    mockProviderState.albums = [okComputer];
    vi.mocked(fetchAlbumsPage).mockResolvedValue({
      items: [okComputer],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    const { rerender } = render(<BrowsePage />);

    await waitFor(() =>
      expect(screen.getByText("OK Computer")).toBeInTheDocument(),
    );

    mockProviderState.albums = [okComputer, generatedAlbum];
    rerender(<BrowsePage />);

    await waitFor(() =>
      expect(screen.getByText("Generated Album")).toBeInTheDocument(),
    );
  });

  it("replaces a synced offline temp album instead of showing it twice", async () => {
    const { fetchAlbumsPage } = await import("@/lib/api-client");
    const offlineAlbum = {
      id: "__offline_offline-album",
      title: "Offline Album",
      artist: "Local",
      year: 2026,
      genre: "Rock",
      coverUrl: "https://example.com/offline.jpg",
      description: "",
      rating: 0,
      featured: false,
    };
    const syncedAlbum = {
      ...offlineAlbum,
      id: "offline-album",
    };

    mockProviderState.albums = [offlineAlbum];
    mockOfflineState.queue = [
      {
        type: "create",
        tempId: offlineAlbum.id,
        payload: {
          title: offlineAlbum.title,
          artist: offlineAlbum.artist,
          year: offlineAlbum.year,
          genre: offlineAlbum.genre,
          coverUrl: offlineAlbum.coverUrl,
          description: offlineAlbum.description,
          rating: offlineAlbum.rating,
          featured: offlineAlbum.featured,
        },
      },
    ];
    vi.mocked(fetchAlbumsPage).mockRejectedValue(new Error("server down"));

    const { rerender } = render(<BrowsePage />);

    await waitFor(() =>
      expect(screen.getByText("Offline Album")).toBeInTheDocument(),
    );

    mockProviderState.albums = [syncedAlbum];
    mockOfflineState.queue = [];
    mockOfflineState.idMap = {
      [offlineAlbum.id]: syncedAlbum.id,
    };
    vi.mocked(fetchAlbumsPage).mockResolvedValue({
      items: [syncedAlbum],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    rerender(<BrowsePage />);

    await waitFor(() =>
      expect(screen.getAllByText("Offline Album")).toHaveLength(1),
    );
  });
});
