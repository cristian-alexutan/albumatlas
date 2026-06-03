import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TracksPanel } from "@/app/components/tracks-panel";
import * as api from "@/lib/api-client";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Track } from "@/lib/api-client";

// ── mock the API ──────────────────────────────────────────────────────────────

vi.mock("@/lib/api-client", () => ({
  fetchTracks: vi.fn(),
  createTrack: vi.fn(),
  updateTrack: vi.fn(),
  deleteTrack: vi.fn(),
}));

const mockTrack: Track = {
  id: "t1",
  albumId: "ok-computer",
  title: "Airbag",
  position: 1,
  durationSec: 277,
};

// ── helpers ───────────────────────────────────────────────────────────────────

function renderPanel(canManage = true) {
  return render(<TracksPanel albumId="ok-computer" canManage={canManage} />);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("TracksPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchTracks).mockResolvedValue([mockTrack]);
  });

  it("shows loading state then renders tracks", async () => {
    renderPanel();

    expect(screen.getByText("Loading tracks…")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText("Airbag")).toBeInTheDocument(),
    );
    expect(screen.getByText("4:37")).toBeInTheDocument(); // 277 sec formatted
  });

  it("shows 'No tracks yet.' when album has no tracks", async () => {
    vi.mocked(api.fetchTracks).mockResolvedValue([]);

    renderPanel();

    await waitFor(() =>
      expect(screen.getByText("No tracks yet.")).toBeInTheDocument(),
    );
  });

  it("hides Add Track button when canManage is false", async () => {
    renderPanel(false);

    await waitFor(() => expect(screen.getByText("Airbag")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: "+ Add Track" })).toBeNull();
  });

  it("shows add-track form on button click and creates a track", async () => {
    const newTrack: Track = {
      id: "t2",
      albumId: "ok-computer",
      title: "Paranoid Android",
      position: 2,
      durationSec: 383,
    };
    vi.mocked(api.createTrack).mockResolvedValue(newTrack);

    renderPanel();
    await waitFor(() => expect(screen.getByText("Airbag")).toBeInTheDocument());

    // Open add form
    fireEvent.click(screen.getByRole("button", { name: "+ Add Track" }));
    expect(screen.getByPlaceholderText("Track title")).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByPlaceholderText("Track title"), {
      target: { value: "Paranoid Android" },
    });
    fireEvent.change(screen.getByPlaceholderText("#"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByPlaceholderText("sec"), {
      target: { value: "383" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    });

    await waitFor(() =>
      expect(screen.getByText("Paranoid Android")).toBeInTheDocument(),
    );
    expect(api.createTrack).toHaveBeenCalledWith("ok-computer", {
      title: "Paranoid Android",
      position: 2,
      durationSec: 383,
    });
  });

  it("shows validation error when track title is empty", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Airbag")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "+ Add Track" }));

    // Leave title empty, fill the rest
    fireEvent.change(screen.getByPlaceholderText("#"), { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("sec"), { target: { value: "200" } });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(api.createTrack).not.toHaveBeenCalled();
  });

  it("shows validation error when position is invalid", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Airbag")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "+ Add Track" }));

    fireEvent.change(screen.getByPlaceholderText("Track title"), {
      target: { value: "Some Track" },
    });
    fireEvent.change(screen.getByPlaceholderText("#"), { target: { value: "0" } });
    fireEvent.change(screen.getByPlaceholderText("sec"), { target: { value: "120" } });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Position must be a positive integer.")).toBeInTheDocument();
    expect(api.createTrack).not.toHaveBeenCalled();
  });

  it("enters edit mode inline and saves updated track", async () => {
    const updatedTrack: Track = { ...mockTrack, title: "Airbag (Live)" };
    vi.mocked(api.updateTrack).mockResolvedValue(updatedTrack);

    renderPanel();
    await waitFor(() => expect(screen.getByText("Airbag")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    // Inline edit inputs should appear
    const titleInput = screen.getByPlaceholderText("Title");
    expect(titleInput).toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: "Airbag (Live)" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    await waitFor(() =>
      expect(screen.getByText("Airbag (Live)")).toBeInTheDocument(),
    );
    expect(api.updateTrack).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ title: "Airbag (Live)" }),
    );
  });

  it("cancels edit mode without saving", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Airbag")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByPlaceholderText("Title")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByPlaceholderText("Title")).toBeNull();
    expect(screen.getByText("Airbag")).toBeInTheDocument();
    expect(api.updateTrack).not.toHaveBeenCalled();
  });

  it("deletes a track after confirm", async () => {
    vi.mocked(api.deleteTrack).mockResolvedValue(true);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPanel();
    await waitFor(() => expect(screen.getByText("Airbag")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    await waitFor(() =>
      expect(screen.queryByText("Airbag")).toBeNull(),
    );
    expect(api.deleteTrack).toHaveBeenCalledWith("t1");
    expect(screen.getByText("No tracks yet.")).toBeInTheDocument();
  });

  it("does not delete when confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderPanel();
    await waitFor(() => expect(screen.getByText("Airbag")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.deleteTrack).not.toHaveBeenCalled();
    expect(screen.getByText("Airbag")).toBeInTheDocument();
  });

  it("shows error when createTrack API call fails", async () => {
    vi.mocked(api.createTrack).mockRejectedValue(new Error("server error"));

    renderPanel();
    await waitFor(() => expect(screen.getByText("Airbag")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "+ Add Track" }));
    fireEvent.change(screen.getByPlaceholderText("Track title"), {
      target: { value: "New Track" },
    });
    fireEvent.change(screen.getByPlaceholderText("#"), { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("sec"), { target: { value: "200" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    });

    await waitFor(() =>
      expect(screen.getByText("Failed to create track.")).toBeInTheDocument(),
    );
  });
});
