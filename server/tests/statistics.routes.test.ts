import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { statisticsRouter } from "../src/rest/statistics.routes.js";
import { repository } from "../src/repository.js";
import type { Album } from "../src/types.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/statistics", statisticsRouter);
  return app;
}

const SEED: Album = {
  id: "ok-computer",
  title: "OK Computer",
  artist: "Radiohead",
  year: 1997,
  genre: "Alternative Rock",
  coverUrl: "https://example.com/cover.jpg",
  description: "",
  rating: 4.7,
  featured: false,
};

beforeEach(() => {
  repository.reset([SEED], []);
});

describe("GET /api/statistics", () => {
  it("returns statistics for the current album collection", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/statistics");
    expect(res.status).toBe(200);
    expect(res.body.albumCount).toBe(1);
    expect(res.body.averageRating).toBe(4.7);
    expect(res.body.byGenre).toEqual([{ genre: "Alternative Rock", albumCount: 1 }]);
    expect(res.body.byDecade).toEqual([{ decade: "1990s", albumCount: 1 }]);
    expect(res.body.topRated).toHaveLength(1);
  });

  it("returns zero stats when the repository is empty", async () => {
    repository.reset([], []);
    const app = makeApp();
    const res = await request(app).get("/api/statistics");
    expect(res.status).toBe(200);
    expect(res.body.albumCount).toBe(0);
    expect(res.body.averageRating).toBe(0);
    expect(res.body.byGenre).toHaveLength(0);
    expect(res.body.topRated).toHaveLength(0);
  });
});
