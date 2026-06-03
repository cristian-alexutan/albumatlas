import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import HomePage from "@/app/page";

vi.mock("@/app/home-view", () => ({
  HomeView: () => <div>mock-home-view</div>,
}));

describe("HomePage", () => {
  it("renders HomeView container", () => {
    render(<HomePage />);
    expect(screen.getByText("mock-home-view")).toBeInTheDocument();
  });
});

