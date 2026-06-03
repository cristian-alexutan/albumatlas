import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlbumForm } from "@/app/components/album-form";
import { vi, describe, it, expect, beforeEach } from "vitest";

const pushMock = vi.fn();
const createAlbumMock = vi.fn();
const updateAlbumMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/app/components/albums-provider", () => ({
  useAlbums: () => ({
    createAlbum: createAlbumMock,
    updateAlbum: updateAlbumMock,
  }),
}));

function fillForm() {
  const textboxes = screen.getAllByRole("textbox");
  fireEvent.change(textboxes[0], { target: { value: "  New Album  " } });
  fireEvent.change(textboxes[1], { target: { value: "  New Artist  " } });
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2024" } });
  fireEvent.change(textboxes[2], { target: { value: "  Rock  " } });
  fireEvent.change(textboxes[3], { target: { value: "  https://example.com/new.jpg  " } });
  fireEvent.change(textboxes[4], { target: { value: "  New Description  " } });
}

describe("AlbumForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    createAlbumMock.mockReset();
    updateAlbumMock.mockReset();
  });

  it("creates an album and redirects to details page", async () => {
    createAlbumMock.mockResolvedValue({ id: "new-album-id" });

    render(<AlbumForm mode="create" />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/albums/new-album-id"));
    expect(createAlbumMock).toHaveBeenCalledWith({
      title: "New Album",
      artist: "New Artist",
      year: 2024,
      genre: "Rock",
      coverUrl: "https://example.com/new.jpg",
      description: "New Description",
    });
  });

  it("shows validation error when year is invalid", async () => {
    render(<AlbumForm mode="create" />);
    fillForm();
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "0" } });
    // Use fireEvent.submit on the <form> to bypass jsdom's HTML5 constraint
    // validation (which would block the click on type=submit with min/max attrs).
    const form = screen.getByRole("button", { name: "Save" }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByText("Please enter a valid year.")).toBeInTheDocument(),
    );
    expect(createAlbumMock).not.toHaveBeenCalled();
  });

  it("shows error when edit mode has no album id", async () => {
    render(<AlbumForm mode="edit" />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Missing album id.")).toBeInTheDocument();
    expect(updateAlbumMock).not.toHaveBeenCalled();
  });

  it("updates album in edit mode and redirects", async () => {
    updateAlbumMock.mockResolvedValue({ id: "ok-computer" });

    render(
      <AlbumForm
        mode="edit"
        albumId="ok-computer"
        initialValues={{ title: "Old", artist: "Old Artist", year: 1990, genre: "Old Genre", coverUrl: "https://example.com/old.jpg", description: "Old Desc" }}
      />,
    );
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/albums/ok-computer"));
    expect(updateAlbumMock).toHaveBeenCalledWith("ok-computer", {
      title: "New Album",
      artist: "New Artist",
      year: 2024,
      genre: "Rock",
      coverUrl: "https://example.com/new.jpg",
      description: "New Description",
    });
  });

  it("shows not found error when update returns undefined", async () => {
    updateAlbumMock.mockResolvedValue(undefined);

    render(<AlbumForm mode="edit" albumId="missing" />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText("Album not found.")).toBeInTheDocument(),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows generic error when save throws", async () => {
    createAlbumMock.mockRejectedValue(new Error("network error"));

    render(<AlbumForm mode="create" />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText("Could not save album. Please try again.")).toBeInTheDocument(),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
