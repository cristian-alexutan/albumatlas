import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { generatorRouter } from "../src/rest/generator.routes.js";
import { generator } from "../src/generator.js";
import { repository } from "../src/repository.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = {
      userId: "seed_admin",
      username: "admin",
      role: "ADMIN",
      authToken: "test-token",
      tokenExpiresAt: Date.now() + 60_000,
      lastActivityAt: Date.now(),
    } as typeof req.session;
    next();
  });
  app.use("/api/generator", generatorRouter);
  return app;
}

afterEach(() => {
  // Always stop the generator and clean up albums it created
  if (generator.running) generator.stop();
  repository.reset([], []);
});

describe("GET /api/generator/status", () => {
  it("returns running: false when the generator is idle", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/generator/status");
    expect(res.status).toBe(200);
    expect(res.body.running).toBe(false);
  });

  it("returns running: true while the generator is active", async () => {
    generator.start();
    const app = makeApp();
    const res = await request(app).get("/api/generator/status");
    expect(res.status).toBe(200);
    expect(res.body.running).toBe(true);
  });
});

describe("POST /api/generator/start", () => {
  it("starts the generator and returns 200", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/generator/start");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("started");
    expect(generator.running).toBe(true);
  });

  it("returns 409 when the generator is already running", async () => {
    generator.start();
    const app = makeApp();
    const res = await request(app).post("/api/generator/start");
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Generator already running");
  });
});

describe("POST /api/generator/stop", () => {
  it("stops the generator and returns 200", async () => {
    generator.start();
    const app = makeApp();
    const res = await request(app).post("/api/generator/stop");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("stopped");
    expect(generator.running).toBe(false);
  });

  it("returns 409 when the generator is not running", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/generator/stop");
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Generator is not running");
  });
});
