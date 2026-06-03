import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import LoginPage from "@/app/login/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/login/login-view", () => ({
  LoginView: () => <div>mock-login-view</div>,
}));

describe("LoginPage", () => {
  it("renders LoginView container", () => {
    render(<LoginPage />);
    expect(screen.getByText("mock-login-view")).toBeInTheDocument();
  });
});

