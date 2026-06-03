import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import RegisterPage from "@/app/register/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/register/register-view", () => ({
  RegisterView: () => <div>mock-register-view</div>,
}));

describe("RegisterPage", () => {
  it("renders RegisterView container", () => {
    render(<RegisterPage />);
    expect(screen.getByText("mock-register-view")).toBeInTheDocument();
  });
});

