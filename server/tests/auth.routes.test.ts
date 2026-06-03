import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import * as OTPAuth from "otpauth";
import { createApp } from "../src/app.js";
import { authService } from "../src/auth/auth-service.js";
import { repository } from "../src/repository.js";
import type { Express } from "express";

let app: Express;

// Fixed TOTP secrets for the seed users (same defaults used in auth-service.ts).
const SEED_ADMIN_TOTP = "JBSWY3DPEHPK3PXP";
const SEED_USER_TOTP  = "NBSWY3DPEHPK3PXP";

function makeTotpToken(secret: string): string {
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits:    6,
    period:    30,
    secret:    OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate();
}

const albumBody = {
  id:          "secure-album",
  title:       "Secure Album",
  artist:      "The Sessions",
  year:        2026,
  genre:       "Rock",
  coverUrl:    "https://example.com/secure.jpg",
  description: "Protected create route",
};

async function loginAs(username: string, password: string, totpSecret: string) {
  const agent = request.agent(app);
  const start = await agent.post("/api/auth/login").send({ username, password });
  const verify = await agent.post("/api/auth/login/verify").send({
    challengeId: start.body.challengeId,
    emailCode:   start.body.devEmailCode,
    totpCode:    makeTotpToken(totpSecret),
  });
  return { agent, start, verify };
}

beforeEach(async () => {
  authService.resetForTests();
  repository.reset([], []);
  app = await createApp();
});

describe("auth routes", () => {
  it("requires password, email code, and authenticator code before creating a session", async () => {
    const { agent, start, verify } = await loginAs("admin", "admin", SEED_ADMIN_TOTP);

    expect(start.status).toBe(202);
    expect(start.body.challengeId).toEqual(expect.any(String));
    expect(start.body.devEmailCode).toMatch(/^\d{6}$/);

    expect(verify.status).toBe(200);
    expect(verify.body.token).toEqual(expect.any(String));
    expect(verify.body.permissions).toContain("CREATE_ALBUM");

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.username).toBe("admin");
  });

  it("rejects invalid verification codes", async () => {
    const start = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin" });

    const verify = await request(app).post("/api/auth/login/verify").send({
      challengeId: start.body.challengeId,
      emailCode:   "000000",
      totpCode:    "000000",  // wrong code – will be rejected
    });

    expect(verify.status).toBe(401);
    expect(verify.body.error).toContain("Invalid");
  });

  it("registers a user with a hashed server-side account and session", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/register").send({
      username: "new-user",
      password: "secret123",
      email:    "new-user@example.com",
      phone:    "+40700000000",
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("USER");
    expect(res.body.totpSecret).toMatch(/^[A-Z2-7]+=*$/);  // Base32

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.username).toBe("new-user");
  });

  it("recovers a password using email and authenticator codes", async () => {
    const start = await request(app)
      .post("/api/auth/recovery/start")
      .send({ identifier: "user" });
    expect(start.status).toBe(202);

    const complete = await request(app).post("/api/auth/recovery/complete").send({
      challengeId: start.body.challengeId,
      emailCode:   start.body.devEmailCode,
      totpCode:    makeTotpToken(SEED_USER_TOTP),
      newPassword: "changed123",
    });
    expect(complete.status).toBe(200);

    const login = await loginAs("user", "changed123", SEED_USER_TOTP);
    expect(login.verify.status).toBe(200);
  });

  it("allows ADMIN album writes and denies USER album writes", async () => {
    const user    = await loginAs("user",  "user",  SEED_USER_TOTP);
    const denied  = await user.agent.post("/api/albums").send(albumBody);
    expect(denied.status).toBe(403);

    const admin   = await loginAs("admin", "admin", SEED_ADMIN_TOTP);
    const created = await admin.agent.post("/api/albums").send(albumBody);
    expect(created.status).toBe(201);
    expect(created.body.id).toBe("secure-album");
  });
});
