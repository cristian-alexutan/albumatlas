import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlbumsProvider, useAlbums } from "@/app/components/albums-provider";
import * as apiClient from "@/lib/api-client";
import { clearQueue, loadQueue, saveCachedAlbums, saveSyncedIdMap } from "@/lib/offline-queue";

vi.mock("@/lib/api-client", () => ({
  API_BASE: "http://localhost:4000",
  fetchAllAlbums: vi.fn(),
  createAlbum: vi.fn(),
  updateAlbum: vi.fn(),
  deleteAlbum: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

function OfflineHarness() {
  const { albums, createAlbum } = useAlbums();

  return (
    <div>
      <p data-testid="count">{albums.length}</p>
      <p data-testid="titles">{albums.map((album) => album.title).join(",")}</p>
      <button
        type="button"
        onClick={async () => {
          await createAlbum({
            title: "Offline Album",
            artist: "Test Artist",
            year: 2026,
            genre: "Rock",
            coverUrl: "https://example.com/cover.jpg",
            description: "Created while the server is unreachable.",
          });
        }}
      >
        create offline
      </button>
    </div>
  );
}

describe("AlbumsProvider with real offline memory queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearQueue();
    saveCachedAlbums([]);
    saveSyncedIdMap({});
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("queues and displays creates when the API server is unreachable", async () => {
    vi.mocked(apiClient.fetchAllAlbums).mockRejectedValue(new Error("server down"));
    vi.mocked(apiClient.createAlbum).mockRejectedValue(new Error("server down"));

    render(
      <AlbumsProvider>
        <OfflineHarness />
      </AlbumsProvider>,
    );

    await waitFor(() => expect(apiClient.fetchAllAlbums).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "create offline" }));
    });

    expect(screen.getByTestId("titles").textContent).toContain("Offline Album");
    expect(loadQueue()).toEqual([
      expect.objectContaining({
        type: "create",
        tempId: "__offline_offline-album",
      }),
    ]);
  });
});
