import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { albumsRouter } from "../src/rest/albums.routes.js";
import { tracksRouter } from "../src/rest/tracks.routes.js";
import { repository } from "../src/repository.js";
import type { Album, Track } from "../src/types.js";

// ── minimal Express app (no Apollo overhead) ──────────────────────────────────

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

// ── fixtures ──────────────────────────────────────────────────────────────────

const ALBUM: Album = {
  id: "ok-computer",
  title: "OK Computer",
  artist: "Radiohead",
  year: 1997,
  genre: "Alternative Rock",
  coverUrl: "https://example.com/cover.jpg",
  description: "",
  rating: 4.7,
  featured: true,
};

const OTHER_ALBUM: Album = {
  ...ALBUM,
  id: "kid-a",
  title: "Kid A",
};

const TRACK: Track = {
  id: "ok-computer-airbag",
  albumId: "ok-computer",
  title: "Airbag",
  position: 1,
  durationSec: 277,
};

const VALID_TRACK_BODY = {
  title: "Paranoid Android",
  position: 2,
  durationSec: 383,
};

const TRACKS_URL = "/api/albums/ok-computer/tracks";
const TRACK_URL = `${TRACKS_URL}/ok-computer-airbag`;

beforeEach(() => {
  repository.reset([ALBUM, OTHER_ALBUM], [TRACK]);
});

// ── GET /api/albums/:albumId/tracks ───────────────────────────────────────────

describe("GET /api/albums/:albumId/tracks", () => {
  it("lists tracks for the album sorted by position", async () => {
    const app = makeApp();
    const res = await request(app).get(TRACKS_URL);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].title).toBe("Airbag");
  });

  it("returns 404 when the album does not exist", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/albums/missing/tracks");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Album not found");
  });
});

// ── GET /api/albums/:albumId/tracks/:trackId ──────────────────────────────────

describe("GET /api/albums/:albumId/tracks/:trackId", () => {
  it("returns the track when it belongs to the album", async () => {
    const app = makeApp();
    const res = await request(app).get(TRACK_URL);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("ok-computer-airbag");
    expect(res.body.title).toBe("Airbag");
  });

  it("returns 404 when the track does not exist", async () => {
    const app = makeApp();
    const res = await request(app).get(`${TRACKS_URL}/missing-track`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Track not found");
  });

  it("returns 404 when the track belongs to a different album", async () => {
    // Track exists but is owned by "ok-computer", not "kid-a"
    const app = makeApp();
    const res = await request(app).get("/api/albums/kid-a/tracks/ok-computer-airbag");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Track not found");
  });
});

// ── POST /api/albums/:albumId/tracks ─────────────────────────────────────────

describe("POST /api/albums/:albumId/tracks", () => {
  it("creates a track under the album and returns 201", async () => {
    const app = makeApp();
    const res = await request(app).post(TRACKS_URL).send(VALID_TRACK_BODY);
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Paranoid Android");
    expect(res.body.albumId).toBe("ok-computer");
    expect(res.body.id).toBeDefined();
  });

  it("returns 400 when the body fails validation", async () => {
    const app = makeApp();
    const res = await request(app)
      .post(TRACKS_URL)
      .send({ title: "", position: 0, durationSec: -1 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it("returns 404 when the album does not exist", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/albums/missing/tracks")
      .send(VALID_TRACK_BODY);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Album not found");
  });
});

// ── PUT /api/albums/:albumId/tracks/:trackId ──────────────────────────────────

describe("PUT /api/albums/:albumId/tracks/:trackId", () => {
  it("fully replaces the track and returns 200", async () => {
    const app = makeApp();
    const res = await request(app)
      .put(TRACK_URL)
      .send({ title: "Lucky", position: 7, durationSec: 262 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Lucky");
    expect(res.body.position).toBe(7);
  });

  it("returns 404 when the track does not exist", async () => {
    const app = makeApp();
    const res = await request(app)
      .put(`${TRACKS_URL}/missing`)
      .send(VALID_TRACK_BODY);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Track not found");
  });

  it("returns 404 when the track belongs to a different album", async () => {
    const app = makeApp();
    const res = await request(app)
      .put("/api/albums/kid-a/tracks/ok-computer-airbag")
      .send(VALID_TRACK_BODY);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Track not found");
  });

  it("returns 400 when the body fails validation", async () => {
    const app = makeApp();
    const res = await request(app)
      .put(TRACK_URL)
      .send({ title: "", position: -5, durationSec: 0 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

// ── PATCH /api/albums/:albumId/tracks/:trackId ────────────────────────────────

describe("PATCH /api/albums/:albumId/tracks/:trackId", () => {
  it("partially updates the track and returns 200", async () => {
    const app = makeApp();
    const res = await request(app).patch(TRACK_URL).send({ title: "Exit Music" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Exit Music");
    expect(res.body.position).toBe(1); // unchanged
  });

  it("returns 404 when the track does not exist", async () => {
    const app = makeApp();
    const res = await request(app).patch(`${TRACKS_URL}/missing`).send({ title: "X" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Track not found");
  });

  it("returns 404 when the track belongs to a different album", async () => {
    const app = makeApp();
    const res = await request(app)
      .patch("/api/albums/kid-a/tracks/ok-computer-airbag")
      .send({ title: "X" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Track not found");
  });

  it("returns 400 when a provided field fails validation", async () => {
    const app = makeApp();
    const res = await request(app)
      .patch(TRACK_URL)
      .send({ durationSec: -1 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

// ── DELETE /api/albums/:albumId/tracks/:trackId ───────────────────────────────

describe("DELETE /api/albums/:albumId/tracks/:trackId", () => {
  it("deletes the track and returns 204", async () => {
    const app = makeApp();
    const del = await request(app).delete(TRACK_URL);
    expect(del.status).toBe(204);

    const check = await request(app).get(TRACK_URL);
    expect(check.status).toBe(404);
  });

  it("returns 404 when the track does not exist", async () => {
    const app = makeApp();
    const res = await request(app).delete(`${TRACKS_URL}/missing`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Track not found");
  });

  it("returns 404 when the track belongs to a different album", async () => {
    const app = makeApp();
    const res = await request(app).delete(
      "/api/albums/kid-a/tracks/ok-computer-airbag",
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Track not found");
  });
});
