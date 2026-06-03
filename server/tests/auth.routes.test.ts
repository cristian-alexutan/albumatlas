import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { authService } from "../src/auth/auth-service.js";
import { repository } from "../src/repository.js";
import type { Express } from "express";

let app: Express;

const albumBody = {
  id: "secure-album",
  title: "Secure Album",
  artist: "The Sessions",
  year: 2026,
  genre: "Rock",
  coverUrl: "https://example.com/secure.jpg",
  description: "Protected create route",
};

async function loginAs(username: string, password: string) {
  const agent = request.agent(app);
  const start = await agent.post("/api/auth/login").send({ username, password });
  const verify = await agent.post("/api/auth/login/verify").send({
    challengeId: start.body.challengeId,
    emailCode: start.body.devEmailCode,
    smsCode: start.body.devSmsCode,
  });
  return { agent, start, verify };
}

beforeEach(async () => {
  authService.resetForTests();
  repository.reset([], []);
  app = await createApp();
});

describe("auth routes", () => {
  it("requires password, email code, and sms code before creating a session", async () => {
    const { agent, start, verify } = await loginAs("admin", "admin");

    expect(start.status).toBe(202);
    expect(start.body.challengeId).toEqual(expect.any(String));
    expect(start.body.devEmailCode).toMatch(/^\d{6}$/);
    expect(start.body.devSmsCode).toMatch(/^\d{6}$/);

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
      emailCode: "000000",
      smsCode: "000000",
    });

    expect(verify.status).toBe(401);
    expect(verify.body.error).toContain("Invalid");
  });

  it("registers a user with a hashed server-side account and session", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/register").send({
      username: "new-user",
      password: "secret123",
      email: "new-user@example.com",
      phone: "+40700000000",
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("USER");

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.username).toBe("new-user");
  });

  it("recovers a password using email and sms codes", async () => {
    const start = await request(app)
      .post("/api/auth/recovery/start")
      .send({ identifier: "user" });
    expect(start.status).toBe(202);

    const complete = await request(app).post("/api/auth/recovery/complete").send({
      challengeId: start.body.challengeId,
      emailCode: start.body.devEmailCode,
      smsCode: start.body.devSmsCode,
      newPassword: "changed123",
    });
    expect(complete.status).toBe(200);

    const login = await loginAs("user", "changed123");
    expect(login.verify.status).toBe(200);
  });

  it("allows ADMIN album writes and denies USER album writes", async () => {
    const user = await loginAs("user", "user");
    const denied = await user.agent.post("/api/albums").send(albumBody);
    expect(denied.status).toBe(403);

    const admin = await loginAs("admin", "admin");
    const created = await admin.agent.post("/api/albums").send(albumBody);
    expect(created.status).toBe(201);
    expect(created.body.id).toBe("secure-album");
  });
});
