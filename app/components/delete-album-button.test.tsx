import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteAlbumButton } from "@/app/components/delete-album-button";
import { vi, describe, it, expect, beforeEach } from "vitest";

const pushMock = vi.fn();
const deleteAlbumMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/app/components/albums-provider", () => ({
  useAlbums: () => ({ deleteAlbum: deleteAlbumMock }),
}));

describe("DeleteAlbumButton", () => {
  beforeEach(() => {
    pushMock.mockReset();
    deleteAlbumMock.mockReset();
  });

  it("does nothing when user cancels confirm dialog", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<DeleteAlbumButton albumId="ok-computer" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Album" }));
    expect(deleteAlbumMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("deletes and redirects when confirm is accepted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteAlbumMock.mockResolvedValue(true);
    render(<DeleteAlbumButton albumId="ok-computer" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Album" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/browse"));
    expect(deleteAlbumMock).toHaveBeenCalledWith("ok-computer");
  });

  it("does not redirect when delete returns false", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteAlbumMock.mockResolvedValue(false);
    render(<DeleteAlbumButton albumId="missing" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Album" }));
    await waitFor(() => expect(deleteAlbumMock).toHaveBeenCalledWith("missing"));
    expect(pushMock).not.toHaveBeenCalled();
  });
});
