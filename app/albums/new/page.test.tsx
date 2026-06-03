import { render, screen } from "@testing-library/react";
import AddAlbumPage from "@/app/albums/new/page";
import { vi } from "vitest";

vi.mock("@/app/components/auth-provider", () => ({
  useAuth: () => ({ currentUser: { username: "admin", role: "admin" } }),
}));

vi.mock("@/app/components/albums-provider", () => ({
  useAlbums: () => ({ isOnline: true, isServerReachable: true, isSyncing: false }),
}));

vi.mock("@/app/components/album-form", () => ({
  AlbumForm: ({ mode }: { mode: string }) => <div>form-{mode}</div>,
}));

describe("AddAlbumPage", () => {
  it("renders create form in album layout", () => {
    render(<AddAlbumPage />);

    expect(screen.getByRole("link", { name: "← Back to album list" })).toHaveAttribute("href", "/browse");
    expect(screen.getByText("form-create")).toBeInTheDocument();
  });
});

