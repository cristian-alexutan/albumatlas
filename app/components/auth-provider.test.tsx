import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/app/components/auth-provider";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function AuthHarness() {
  const { currentUser, signIn, verifyLogin, signOut } = useAuth();

  async function handleSignIn() {
    const result = await signIn("admin", "admin");
    if (!result.ok && "mfaRequired" in result) {
      await verifyLogin(
        result.challenge.challengeId,
        result.challenge.devEmailCode ?? "",
        result.challenge.devSmsCode ?? "",
      );
    }
  }

  return (
    <div>
      <p data-testid="user">{currentUser?.username ?? "signed-out"}</p>
      <button type="button" onClick={handleSignIn}>
        sign in
      </button>
      <button type="button" onClick={signOut}>
        sign out
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("restores the logged-in user from the server session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      id: "seed_admin",
      username: "admin",
      role: "ADMIN",
    })));

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("admin"));
  });

  it("completes MFA sign in and clears state on sign out", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({
        challengeId: "challenge-1",
        expiresAt: Date.now() + 60_000,
        devEmailCode: "123456",
        devSmsCode: "654321",
      }, { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({
        id: "seed_admin",
        username: "admin",
        role: "ADMIN",
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "sign in" }));

    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("admin"));

    fireEvent.click(screen.getByRole("button", { name: "sign out" }));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("signed-out"));
  });
});
