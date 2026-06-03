import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { AlbumsProvider, useAlbums } from "@/app/components/albums-provider";
import * as apiClient from "@/lib/api-client";
import * as offlineQueue from "@/lib/offline-queue";
import type { Album } from "@/lib/api-client";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ── mock the API client so tests never hit the network ────────────────────────

// vi.mock factories are hoisted above variable declarations, so we must use
// vi.hoisted() for any value that the factory needs to reference.
const mockAlbum = vi.hoisted<Album>(() => ({
  id: "ok-computer",
  title: "OK Computer",
  artist: "Radiohead",
  year: 1997,
  genre: "Alternative Rock",
  coverUrl: "https://example.com/ok.jpg",
  description: "A classic",
  rating: 4.7,
  featured: true,
}));

vi.mock("@/lib/api-client", () => ({
  API_BASE: "http://localhost:4000",
  fetchAllAlbums: vi.fn().mockResolvedValue([mockAlbum]),
  fetchAlbumsPage: vi.fn().mockResolvedValue({ items: [mockAlbum], page: 1, pageSize: 20, total: 1, totalPages: 1 }),
  createAlbum: vi.fn().mockResolvedValue({ ...mockAlbum, id: "new-album", title: "New" }),
  updateAlbum: vi.fn().mockResolvedValue({ ...mockAlbum, title: "Updated" }),
  deleteAlbum: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/offline-queue", () => ({
  loadQueue: vi.fn().mockReturnValue([]),
  saveQueue: vi.fn(),
  enqueue: vi.fn(),
  clearQueue: vi.fn(),
  loadCachedAlbums: vi.fn().mockReturnValue([]),
  saveCachedAlbums: vi.fn(),
  loadSyncedIdMap: vi.fn().mockReturnValue({}),
  saveSyncedIdMap: vi.fn(),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function TestHarness() {
  const { albums, isLoading, createAlbum, updateAlbum, deleteAlbum, getAlbumById } = useAlbums();
  const [result, setResult] = useState("none");

  if (isLoading) return <p data-testid="loading">loading</p>;

  return (
    <div>
      <p data-testid="count">{albums.length}</p>
      <p data-testid="result">{result}</p>

      <button
        type="button"
        onClick={async () => {
          const a = await createAlbum({ title: "New", artist: "X", year: 2024, genre: "Pop", coverUrl: "https://x.com/a.jpg", description: "" });
          setResult(a.id);
        }}
      >create</button>

      <button
        type="button"
        onClick={async () => {
          const a = await updateAlbum("ok-computer", { title: "Updated", artist: "X", year: 1997, genre: "Alt", coverUrl: "https://x.com/a.jpg", description: "" });
          setResult(a?.title ?? "missing");
        }}
      >update</button>

      <button
        type="button"
        onClick={async () => {
          const ok = await deleteAlbum("ok-computer");
          setResult(String(ok));
        }}
      >delete</button>

      <button
        type="button"
        onClick={() => {
          const found = getAlbumById("ok-computer");
          setResult(found ? found.title : "missing");
        }}
      >get</button>
    </div>
  );
}

function OutsideConsumer() {
  useAlbums();
  return null;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("AlbumsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.fetchAllAlbums).mockResolvedValue([mockAlbum]);
    vi.mocked(offlineQueue.loadCachedAlbums).mockReturnValue([]);
    vi.mocked(offlineQueue.loadQueue).mockReturnValue([]);
    vi.mocked(offlineQueue.loadSyncedIdMap).mockReturnValue({});
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("loads albums from API on mount", async () => {
    render(<AlbumsProvider><TestHarness /></AlbumsProvider>);
    // isLoading is always false in the provider; wait for the actual fetch to settle
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
  });

  it("throws when used outside AlbumsProvider", () => {
    expect(() => render(<OutsideConsumer />)).toThrow("useAlbums must be used within AlbumsProvider.");
  });

  it("createAlbum calls API and reflects result", async () => {
    render(<AlbumsProvider><TestHarness /></AlbumsProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "create" })); });
    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("new-album"));
  });

  it("updateAlbum calls API and returns updated album", async () => {
    render(<AlbumsProvider><TestHarness /></AlbumsProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "update" })); });
    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("Updated"));
  });

  it("deleteAlbum calls API and returns true", async () => {
    render(<AlbumsProvider><TestHarness /></AlbumsProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "delete" })); });
    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("true"));
  });

  it("getAlbumById returns album from local state", async () => {
    render(<AlbumsProvider><TestHarness /></AlbumsProvider>);
    // Wait for the initial fetch to populate state before querying
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    fireEvent.click(screen.getByRole("button", { name: "get" }));
    expect(screen.getByTestId("result").textContent).toBe("OK Computer");
  });

  it("queues create locally when offline", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    render(<AlbumsProvider><TestHarness /></AlbumsProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "create" })); });

    await waitFor(() => {
      expect(screen.getByTestId("result").textContent?.startsWith("__offline_new")).toBe(true);
    });

    expect(apiClient.createAlbum).not.toHaveBeenCalled();
    expect(offlineQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: "create", tempId: expect.any(String) }),
    );
  });

  it("queues update locally when offline", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    vi.mocked(offlineQueue.loadCachedAlbums).mockReturnValue([mockAlbum]);

    render(<AlbumsProvider><TestHarness /></AlbumsProvider>);
    // Even when offline, the API mock resolves — wait for albums to populate so
    // the optimistic currentAlbum lookup can find "ok-computer" in state.
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "update" })); });

    await waitFor(() =>
      expect(screen.getByTestId("result").textContent).toBe("Updated"),
    );

    expect(apiClient.updateAlbum).not.toHaveBeenCalled();
    expect(offlineQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: "update", id: "ok-computer" }),
    );
  });

  it("queues delete locally when offline", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    render(<AlbumsProvider><TestHarness /></AlbumsProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "delete" })); });

    await waitFor(() =>
      expect(screen.getByTestId("result").textContent).toBe("true"),
    );

    expect(apiClient.deleteAlbum).not.toHaveBeenCalled();
    expect(offlineQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: "delete", id: "ok-computer" }),
    );
  });
});
