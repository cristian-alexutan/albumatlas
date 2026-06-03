import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi, describe, it, expect } from "vitest";
import RootLayout from "@/app/layout";

vi.mock("@/app/components/albums-provider", () => ({
  AlbumsProvider: ({ children }: { children: ReactNode }) => <div data-testid="provider">{children}</div>,
}));

describe("RootLayout", () => {
  it("wraps children with AlbumsProvider", () => {
    render(
      <RootLayout>
        <div>child-content</div>
      </RootLayout>,
    );

    expect(screen.getByTestId("provider")).toBeInTheDocument();
    expect(screen.getByText("child-content")).toBeInTheDocument();
  });
});