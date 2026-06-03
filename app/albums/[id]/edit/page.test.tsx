import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import EditAlbumPage from "@/app/albums/[id]/edit/page";

const useAlbumsMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "ok-computer" }),
}));

vi.mock("@/app/components/albums-provider", () => ({
  useAlbums: () => useAlbumsMock(),
}));

vi.mock("@/app/components/auth-provider", () => ({
  useAuth: () => ({ currentUser: { username: "admin", role: "admin" } }),
}));

vi.mock("@/app/components/album-form", () => ({
  AlbumForm: ({ mode, albumId }: { mode: string; albumId: string }) => <div>form-{mode}-{albumId}</div>,
}));

describe("EditAlbumPage", () => {
  it("renders fallback text when album is missing", async () => {
    useAlbumsMock.mockReturnValue({ getAlbumById: () => undefined });

    render(<EditAlbumPage />);

    await waitFor(() => expect(screen.getByText("Album not found.")).toBeInTheDocument());
  });

  it("renders edit form when album exists", () => {
    useAlbumsMock.mockReturnValue({
      getAlbumById: () => ({ id: "ok-computer", title: "OK Computer" }),
    });

    render(<EditAlbumPage />);

    expect(screen.getByRole("link", { name: "← Back to album details" })).toHaveAttribute("href", "/albums/ok-computer");
    expect(screen.getByText("form-edit-ok-computer")).toBeInTheDocument();
  });
});

