import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import * as OTPAuth from "otpauth";

export type Role = "ADMIN" | "USER";

export type Permission =
  | "READ_ALBUM"
  | "CREATE_ALBUM"
  | "UPDATE_ALBUM"
  | "DELETE_ALBUM"
  | "CREATE_REVIEW"
  | "DELETE_REVIEW"
  | "MANAGE_USERS";

export type AuthUser = {
  id:       string;
  username: string;
  email?:   string;
  phone?:   string;
  role:     Role;
};

type StoredUser = AuthUser & {
  passwordHash: string;
  totpSecret:   string;  // Base32-encoded TOTP secret
};

type ChallengePurpose = "login" | "recovery";

type Challenge = {
  id:        string;
  userId:    string;
  purpose:   ChallengePurpose;
  emailCode: string;
  expiresAt: number;
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "READ_ALBUM",
    "CREATE_ALBUM",
    "UPDATE_ALBUM",
    "DELETE_ALBUM",
    "CREATE_REVIEW",
    "DELETE_REVIEW",
    "MANAGE_USERS",
  ],
  USER: ["READ_ALBUM", "CREATE_REVIEW"],
};

const TOKEN_TTL_MS     = Number(process.env.AUTH_TOKEN_TTL_MS     ?? 15 * 60 * 1000);
const CHALLENGE_TTL_MS = Number(process.env.AUTH_CHALLENGE_TTL_MS ?? 5  * 60 * 1000);
const HASH_ITERATIONS  = 120_000;

// Well-known dev secrets so seed users can be added to Google Authenticator once
// and not have to re-scan after every server restart.
const SEED_ADMIN_TOTP = process.env.SEED_ADMIN_TOTP ?? "JBSWY3DPEHPK3PXP";
const SEED_USER_TOTP  = process.env.SEED_USER_TOTP  ?? "NBSWY3DPEHPK3PXP";

// ── Low-level helpers ─────────────────────────────────────────────────────────

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function tokenSecret() {
  return process.env.AUTH_TOKEN_SECRET ?? process.env.SESSION_SECRET ?? "albumatlas-dev-token-secret";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, 32, "sha256").toString("base64url");
  return `pbkdf2$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith("pbkdf2$")) return stored === password;
  const [, iterationsRaw, salt, expected] = stored.split("$");
  const iterations = Number(iterationsRaw);
  if (!iterations || !salt || !expected) return false;
  const actual      = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const expectedBuf = Buffer.from(expected, "base64url");
  return actual.length === expectedBuf.length && timingSafeEqual(actual, expectedBuf);
}

function generateTotpSecret(): string {
  return new OTPAuth.Secret().base32;
}

function makeTotpInstance(username: string, secret: string) {
  return new OTPAuth.TOTP({
    issuer:    "AlbumAtlas",
    label:     username,
    algorithm: "SHA1",
    digits:    6,
    period:    30,
    secret:    OTPAuth.Secret.fromBase32(secret),
  });
}

export function totpUri(username: string, secret: string): string {
  return makeTotpInstance(username, secret).toString();
}

export function verifyTotp(secret: string, token: string): boolean {
  const totp = makeTotpInstance("", secret);
  // validate() returns the step-delta (0 or ±1) when valid, null when invalid
  return totp.validate({ token: token.trim(), window: 1 }) !== null;
}

function publicUser(user: StoredUser): AuthUser {
  const { passwordHash: _ph, totpSecret: _ts, ...rest } = user;
  return rest;
}

function createToken(user: AuthUser) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const header    = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload   = base64Url(JSON.stringify({
    sub:         user.id,
    username:    user.username,
    role:        user.role,
    permissions: ROLE_PERMISSIONS[user.role],
    exp:         Math.floor(expiresAt / 1000),
  }));
  const signature = createHmac("sha256", tokenSecret())
    .update(`${header}.${payload}`)
    .digest("base64url");
  return { token: `${header}.${payload}.${signature}`, expiresAt };
}

// ── Service class ─────────────────────────────────────────────────────────────

class AuthService {
  private users      = new Map<string, StoredUser>();
  private challenges = new Map<string, Challenge>();

  constructor() {
    this.seedDefaults();
  }

  seedDefaults() {
    if (this.users.size > 0) return;
    this.createSeedUser("admin", "admin", "ADMIN", "admin@albumatlas.local", "+40000000001", SEED_ADMIN_TOTP);
    this.createSeedUser("user",  "user",  "USER",  "user@albumatlas.local",  "+40000000002", SEED_USER_TOTP);

    if (process.env.NODE_ENV !== "production") {
      console.info("[auth] Seed TOTP secrets (scan once with Google Authenticator):");
      console.info(`  admin  secret: ${SEED_ADMIN_TOTP}`);
      console.info(`  admin  uri:    ${totpUri("admin", SEED_ADMIN_TOTP)}`);
      console.info(`  user   secret: ${SEED_USER_TOTP}`);
      console.info(`  user   uri:    ${totpUri("user",  SEED_USER_TOTP)}`);
    }
  }

  resetForTests() {
    this.users.clear();
    this.challenges.clear();
    this.seedDefaults();
  }

  permissionsFor(role: Role) {
    return ROLE_PERMISSIONS[role];
  }

  hasPermission(role: Role | undefined, permission: Permission) {
    return role ? ROLE_PERMISSIONS[role]?.includes(permission) === true : false;
  }

  findById(id: string) {
    const user = this.users.get(id);
    return user ? publicUser(user) : null;
  }

  findByUsername(username: string) {
    const normalized = username.trim().toLowerCase();
    const user = [...this.users.values()].find(
      (c) => c.username.toLowerCase() === normalized,
    );
    return user ? publicUser(user) : null;
  }

  upsertStoredUser(input: {
    id:           string;
    username:     string;
    email?:       string | null;
    phone?:       string | null;
    role:         Role;
    passwordHash: string;
    totpSecret?:  string | null;
  }) {
    // Remove duplicate-username entries (handles renames)
    for (const [id, existing] of this.users.entries()) {
      if (id !== input.id && existing.username.toLowerCase() === input.username.toLowerCase()) {
        this.users.delete(id);
      }
    }

    // Preserve existing secret if none provided
    const existing       = this.users.get(input.id);
    const resolvedSecret = input.totpSecret ?? existing?.totpSecret ?? generateTotpSecret();

    const user: StoredUser = {
      id:           input.id,
      username:     input.username,
      email:        input.email  ?? undefined,
      phone:        input.phone  ?? undefined,
      role:         input.role,
      passwordHash: input.passwordHash,
      totpSecret:   resolvedSecret,
    };
    this.users.set(user.id, user);
    return publicUser(user);
  }

  /** Returns TOTP secret + otpauth URI for a given user (used by /totp/setup endpoint). */
  getTotpInfo(userId: string): { secret: string; uri: string } | null {
    const user = this.users.get(userId);
    if (!user) return null;
    return { secret: user.totpSecret, uri: totpUri(user.username, user.totpSecret) };
  }

  register(input: { username: string; password: string; email: string; phone: string }) {
    const username = input.username.trim();
    const email    = input.email.trim();
    const phone    = input.phone.trim();

    if (!username || !input.password || !email || !phone) {
      throw new Error("Username, email, phone, and password are required.");
    }
    if (input.password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
    if (this.findByUsername(username)) {
      const error = new Error("Username already taken.");
      error.name  = "ConflictError";
      throw error;
    }

    const totpSecret = generateTotpSecret();
    const user: StoredUser = {
      id:           `user_${randomBytes(8).toString("hex")}`,
      username,
      email,
      phone,
      role:         "USER",
      passwordHash: hashPassword(input.password),
      totpSecret,
    };
    this.users.set(user.id, user);
    const token = createToken(publicUser(user));
    return { user: publicUser(user), totpSecret, ...token };
  }

  beginLogin(username: string, password: string) {
    const normalized = username.trim().toLowerCase();
    const user = [...this.users.values()].find(
      (c) => c.username.toLowerCase() === normalized,
    );
    if (!user || !verifyPassword(password, user.passwordHash)) return null;
    return this.createChallenge(user, "login");
  }

  completeLogin(challengeId: string, emailCode: string, totpCode: string) {
    const challenge = this.consumeChallenge(challengeId, "login", emailCode, totpCode);
    const user      = this.users.get(challenge.userId);
    if (!user) return null;
    const token = createToken(publicUser(user));
    return { user: publicUser(user), ...token };
  }

  createSessionForUser(userId: string) {
    const user = this.users.get(userId);
    if (!user) return null;
    const token = createToken(publicUser(user));
    return { user: publicUser(user), ...token };
  }

  beginRecovery(identifier: string) {
    const normalized = identifier.trim().toLowerCase();
    const user = [...this.users.values()].find((c) =>
      c.username.toLowerCase() === normalized ||
      c.email?.toLowerCase()   === normalized,
    );
    return user ? this.createChallenge(user, "recovery") : null;
  }

  completeRecovery(challengeId: string, emailCode: string, totpCode: string, newPassword: string) {
    if (newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
    const challenge = this.consumeChallenge(challengeId, "recovery", emailCode, totpCode);
    const user      = this.users.get(challenge.userId);
    if (!user) return null;
    user.passwordHash = hashPassword(newPassword);
    return publicUser(user);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private createSeedUser(
    username:    string,
    password:    string,
    role:        Role,
    email:       string,
    phone:       string,
    totpSecret:  string,
  ) {
    const user: StoredUser = {
      id:           `seed_${username}`,
      username,
      email,
      phone,
      role,
      passwordHash: hashPassword(password),
      totpSecret,
    };
    this.users.set(user.id, user);
  }

  private createChallenge(user: StoredUser, purpose: ChallengePurpose) {
    const emailCode = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

    const challenge: Challenge = {
      id:        randomBytes(16).toString("base64url"),
      userId:    user.id,
      purpose,
      emailCode,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    };
    this.challenges.set(challenge.id, challenge);

    console.info(`[auth] ${purpose} email code for ${user.username}: ${emailCode}`);

    return {
      emailCode,                          // raw code for the mailer to send
      userEmail: user.email ?? null,      // destination address for the mailer
      challenge: {
        challengeId:  challenge.id,
        expiresAt:    challenge.expiresAt,
        emailHint:    user.email ? maskEmail(user.email) : undefined,
        // Only expose the raw code in the HTTP response in non-production (dev convenience)
        devEmailCode: process.env.NODE_ENV === "production" ? undefined : emailCode,
      },
    };
  }

  private consumeChallenge(
    challengeId: string,
    purpose:     ChallengePurpose,
    emailCode:   string,
    totpToken:   string,
  ) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.purpose !== purpose) {
      throw new Error("Invalid or expired verification challenge.");
    }
    if (challenge.expiresAt < Date.now()) {
      this.challenges.delete(challengeId);
      throw new Error("Verification challenge expired.");
    }
    if (challenge.emailCode !== emailCode.trim()) {
      throw new Error("Invalid email verification code.");
    }

    const user = this.users.get(challenge.userId);
    if (!user) throw new Error("User not found.");

    if (!verifyTotp(user.totpSecret, totpToken)) {
      throw new Error("Invalid authenticator code.");
    }

    this.challenges.delete(challengeId);
    return challenge;
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 1)}***@${domain}`;
}

export const authService = new AuthService();
