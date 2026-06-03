"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { API_BASE } from "@/lib/api-client";
import type { AuthUser } from "@/lib/types";

type RegisterPayload = {
  username: string;
  password: string;
  email:    string;
  phone:    string;
};

export type LoginChallenge = {
  challengeId:   string;
  expiresAt:     number;
  emailHint?:    string;
  phoneHint?:    string;
  devEmailCode?: string;
  devSmsCode?:   string;
};

type AuthSuccess = { ok: true };
type AuthFailure = { ok: false; message: string };
type LoginStartResult = AuthFailure | {
  ok:           false;
  mfaRequired:  true;
  challenge:    LoginChallenge;
};

type AuthContextValue = {
  currentUser: AuthUser | null;
  isLoading:   boolean;
  signIn:       (username: string, password: string) => Promise<AuthSuccess | LoginStartResult>;
  verifyLogin:  (challengeId: string, emailCode: string, smsCode: string) => Promise<AuthSuccess | AuthFailure>;
  registerUser: (payload: RegisterPayload) => Promise<AuthSuccess | AuthFailure>;
  startPasswordRecovery: (identifier: string) => Promise<LoginStartResult>;
  completePasswordRecovery: (
    challengeId: string,
    emailCode: string,
    smsCode: string,
    newPassword: string,
  ) => Promise<AuthSuccess | AuthFailure>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const fallbackAuthContext: AuthContextValue = {
  currentUser: null,
  isLoading: false,
  signIn: async () => ({ ok: false, message: "Auth provider is not mounted." }),
  verifyLogin: async () => ({ ok: false, message: "Auth provider is not mounted." }),
  registerUser: async () => ({ ok: false, message: "Auth provider is not mounted." }),
  startPasswordRecovery: async () => ({ ok: false, message: "Auth provider is not mounted." }),
  completePasswordRecovery: async () => ({ ok: false, message: "Auth provider is not mounted." }),
  signOut: async () => {},
};

function toAuthUser(raw: { id: string; username: string; role: string }): AuthUser {
  const role = raw.role === "ADMIN" ? "admin" : "user";
  return { id: raw.id, username: raw.username, role };
}

async function apiPost(path: string, body: unknown) {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readError(res: Response, fallback: string) {
  const body = await res.json().catch(() => ({})) as { error?: string };
  return body.error ?? fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json() as { id: string; username: string; role: string };
          setCurrentUser(toAuthUser(data));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  async function signIn(username: string, password: string) {
    const res = await apiPost("/api/auth/login", { username, password });
    if (res.status === 202) {
      const challenge = await res.json() as LoginChallenge;
      return { ok: false as const, mfaRequired: true as const, challenge };
    }
    if (res.ok) {
      const data = await res.json() as { id: string; username: string; role: string };
      setCurrentUser(toAuthUser(data));
      return { ok: true as const };
    }
    return { ok: false as const, message: await readError(res, "Login failed.") };
  }

  async function verifyLogin(challengeId: string, emailCode: string, smsCode: string) {
    const res = await apiPost("/api/auth/login/verify", { challengeId, emailCode, smsCode });
    if (res.ok) {
      const data = await res.json() as { id: string; username: string; role: string };
      setCurrentUser(toAuthUser(data));
      return { ok: true as const };
    }
    return { ok: false as const, message: await readError(res, "Verification failed.") };
  }

  async function registerUser(payload: RegisterPayload) {
    const res = await apiPost("/api/auth/register", payload);
    if (res.ok) {
      const data = await res.json() as { id: string; username: string; role: string };
      setCurrentUser(toAuthUser(data));
      return { ok: true as const };
    }
    return { ok: false as const, message: await readError(res, "Registration failed.") };
  }

  async function startPasswordRecovery(identifier: string) {
    const res = await apiPost("/api/auth/recovery/start", { identifier });
    if (res.status === 202) {
      const challenge = await res.json() as LoginChallenge;
      return { ok: false as const, mfaRequired: true as const, challenge };
    }
    return { ok: false as const, message: await readError(res, "Password recovery failed.") };
  }

  async function completePasswordRecovery(
    challengeId: string,
    emailCode: string,
    smsCode: string,
    newPassword: string,
  ) {
    const res = await apiPost("/api/auth/recovery/complete", {
      challengeId,
      emailCode,
      smsCode,
      newPassword,
    });
    if (res.ok) return { ok: true as const };
    return { ok: false as const, message: await readError(res, "Password recovery failed.") };
  }

  async function signOut() {
    await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    setCurrentUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        signIn,
        verifyLogin,
        registerUser,
        startPasswordRecovery,
        completePasswordRecovery,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  return context ?? fallbackAuthContext;
}
