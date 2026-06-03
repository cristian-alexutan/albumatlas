import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { albumsRouter } from "../src/rest/albums.routes.js";
import { tracksRouter } from "../src/rest/tracks.routes.js";
import { AlbumRepository, repository } from "../src/repository.js";
import type { Album } from "../src/types.js";

// Reset repository state before each test
const SEED: Album = {
  id: "test-album",
  title: "Test Album",
  artist: "Test Artist",
  year: 2020,
  genre: "Rock",
  coverUrl: "https://example.com/cover.jpg",
  description: "Desc",
  rating: 4.5,
  featured: false,
};

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
  app.use("/api/albums", albumsRouter);
  app.use("/api/albums/:albumId/tracks", tracksRouter);
  return app;
}

beforeEach(() => {
  repository.reset(
    [SEED],
    [{ id: "t1", albumId: "test-album", title: "Track 1", position: 1, durationSec: 180 }],
  );
});

describe("GET /api/albums", () => {
  it("returns paginated albums", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/albums");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, items: expect.any(Array) });
  });

  it("supports search query", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/albums?search=test");
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it("returns empty items for non-matching search", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/albums?search=zzznomatch");
    expect(res.body.items).toHaveLength(0);
  });

  it("rejects invalid page param", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/albums?page=0");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/albums/:id", () => {
  it("returns album by id", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/albums/test-album");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Test Album");
  });

  it("returns 404 for missing album", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/albums/no-such-album");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/albums", () => {
  it("creates an album", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/albums").send({
      title: "New Album",
      artist: "New Artist",
      year: 2023,
      genre: "Pop",
      coverUrl: "https://example.com/img.jpg",
      description: "A brand new album",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("new-album");
  });

  it("rejects missing required fields", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/albums").send({ title: "" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it("rejects invalid coverUrl", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/albums").send({
      title: "X",
      artist: "Y",
      year: 2020,
      genre: "Jazz",
      coverUrl: "not-a-url",
    });
    expect(res.status).toBe(400);
  });

  it("rejects year out of range", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/albums").send({
      title: "Old",
      artist: "Y",
      year: 1800,
      genre: "Classical",
      coverUrl: "https://example.com/img.jpg",
    });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/albums/:id", () => {
  it("updates an album", async () => {
    const app = makeApp();
    const res = await request(app).put("/api/albums/test-album").send({
      title: "Updated Album",
      artist: "Updated Artist",
      year: 2021,
      genre: "Jazz",
      coverUrl: "https://example.com/img.jpg",
      description: "Updated description",
    });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Album");
  });

  it("returns 404 for missing album", async () => {
    const app = makeApp();
    const res = await request(app).put("/api/albums/ghost").send({
      title: "X",
      artist: "Y",
      year: 2020,
      genre: "Rock",
      coverUrl: "https://example.com/img.jpg",
    });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/albums/:id – validation error", () => {
  it("returns 400 when PUT body fails validation", async () => {
    const app = makeApp();
    const res = await request(app)
      .put("/api/albums/test-album")
      .send({ title: "", year: "not-a-number" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe("PATCH /api/albums/:id", () => {
  it("partially updates an album", async () => {
    const app = makeApp();
    const res = await request(app).patch("/api/albums/test-album").send({ rating: 5 });
    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(4.5);
  });

  it("rejects invalid rating", async () => {
    const app = makeApp();
    const res = await request(app).patch("/api/albums/test-album").send({ rating: 10 });
    expect(res.status).toBe(400);
  });

  it("returns 404 when album does not exist", async () => {
    const app = makeApp();
    const res = await request(app).patch("/api/albums/ghost").send({ title: "X" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Album not found");
  });
});

describe("DELETE /api/albums/:id", () => {
  it("deletes an album", async () => {
    const app = makeApp();
    const res = await request(app).delete("/api/albums/test-album");
    expect(res.status).toBe(204);
  });

  it("returns 404 for missing album", async () => {
    const app = makeApp();
    const res = await request(app).delete("/api/albums/ghost");
    expect(res.status).toBe(404);
  });
});

describe("Tracks routes", () => {
  it("GET /api/albums/:albumId/tracks lists tracks", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/albums/test-album/tracks");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].title).toBe("Track 1");
  });

  it("POST /api/albums/:albumId/tracks creates a track", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/albums/test-album/tracks")
      .send({ title: "New Track", position: 2, durationSec: 240 });
    expect(res.status).toBe(201);
    expect(res.body.albumId).toBe("test-album");
  });

  it("POST track rejects invalid durationSec", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/albums/test-album/tracks")
      .send({ title: "Bad", position: 2, durationSec: -1 });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/albums/:albumId/tracks/:trackId deletes a track", async () => {
    const app = makeApp();
    const res = await request(app).delete("/api/albums/test-album/tracks/t1");
    expect(res.status).toBe(204);
  });

  it("returns 404 for track on wrong album", async () => {
    repository.reset(
      [SEED, { ...SEED, id: "other-album", title: "Other" }],
      [{ id: "t1", albumId: "test-album", title: "Track 1", position: 1, durationSec: 180 }],
    );
    const app = makeApp();
    const res = await request(app).get("/api/albums/other-album/tracks/t1");
    expect(res.status).toBe(404);
  });
});
