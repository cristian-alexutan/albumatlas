import { render, screen, waitFor } from "@testing-library/react";
import AlbumDetailPage from "@/app/albums/[id]/page";
import { vi, describe, it, expect, beforeEach } from "vitest";

const useAlbumsMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "ok-computer" }),
}));

vi.mock("@/app/components/albums-provider", () => ({
  useAlbums: () => ({ ...useAlbumsMock(), isOnline: true, isServerReachable: true, isSyncing: false }),
}));

vi.mock("@/app/components/auth-provider", () => ({
  useAuth: () => ({ currentUser: null }),
}));

vi.mock("@/lib/api-client", () => ({
  fetchAlbum: vi.fn(),
}));

vi.mock("@/app/albums/[id]/album-detail-view", () => ({
  AlbumDetailView: ({ album }: { album: { id: string } }) => <div>detail-{album.id}</div>,
}));

describe("AlbumDetailPage", () => {
  beforeEach(() => {
    useAlbumsMock.mockReturnValue({ getAlbumById: vi.fn().mockReturnValue(undefined) });
  });

  it("renders not found view when album is missing from both API and local state", async () => {
    const { fetchAlbum } = await import("@/lib/api-client");
    vi.mocked(fetchAlbum).mockResolvedValue(null);

    render(<AlbumDetailPage />);

    await waitFor(() =>
      expect(screen.getByText("Album not found in the current session.")).toBeInTheDocument(),
    );
  });

  it("renders detail view when album is in local state", async () => {
    // The detail page uses getAlbumById (local state), not fetchAlbum directly.
    useAlbumsMock.mockReturnValue({
      getAlbumById: vi.fn().mockReturnValue({
        id: "ok-computer",
        title: "OK Computer",
        artist: "Radiohead",
        year: 1997,
        genre: "Alternative Rock",
        coverUrl: "https://example.com/ok.jpg",
        description: "A classic",
        rating: 4.7,
        featured: true,
      }),
    });

    render(<AlbumDetailPage />);

    // Album is found synchronously, so no 400 ms wait needed.
    await waitFor(() =>
      expect(screen.getByText("detail-ok-computer")).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "← Back to album list" })).toHaveAttribute("href", "/browse");
  });
});
