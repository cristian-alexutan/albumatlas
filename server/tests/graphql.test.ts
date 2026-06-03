import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { repository } from "../src/repository.js";
import type { Album } from "../src/types.js";
import type { Express } from "express";

const SEED: Album = {
  id: "gql-album",
  title: "GraphQL Album",
  artist: "Graph Artist",
  year: 2022,
  genre: "Electronic",
  coverUrl: "https://example.com/gql.jpg",
  description: "For GQL tests",
  rating: 4.3,
  featured: false,
};

let app: Express;
let adminCookie: string[];

beforeAll(async () => {
  app = await createApp();
  const login = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "admin" });
  const verify = await request(app)
    .post("/api/auth/login/verify")
    .send({
      challengeId: login.body.challengeId,
      emailCode: login.body.devEmailCode,
      smsCode: login.body.devSmsCode,
    });
  adminCookie = verify.headers["set-cookie"];
});

beforeEach(() => {
  repository.reset(
    [SEED],
    [{ id: "gql-t1", albumId: "gql-album", title: "GQL Track", position: 1, durationSec: 200 }],
  );
});

function gql(query: string, variables?: Record<string, unknown>) {
  return request(app)
    .post("/graphql")
    .send({ query, variables })
    .set("Content-Type", "application/json")
    .set("Cookie", adminCookie);
}

describe("GraphQL – queries", () => {
  it("albums query returns a page", async () => {
    const res = await gql(`query { albums { total items { id title } } }`);
    expect(res.status).toBe(200);
    expect(res.body.data.albums.total).toBe(1);
    expect(res.body.data.albums.items[0].title).toBe("GraphQL Album");
  });

  it("album query returns by id", async () => {
    const res = await gql(`query { album(id: "gql-album") { title artist } }`);
    expect(res.status).toBe(200);
    expect(res.body.data.album.title).toBe("GraphQL Album");
  });

  it("album query returns null for unknown id", async () => {
    const res = await gql(`query { album(id: "ghost") { title } }`);
    expect(res.body.data.album).toBeNull();
  });

  it("album.tracks resolves nested tracks", async () => {
    const res = await gql(`query { album(id: "gql-album") { tracks { title position } } }`);
    expect(res.body.data.album.tracks).toHaveLength(1);
    expect(res.body.data.album.tracks[0].title).toBe("GQL Track");
  });

  it("statistics query works", async () => {
    const res = await gql(`query { statistics { albumCount averageRating } }`);
    expect(res.body.data.statistics.albumCount).toBe(1);
    expect(res.body.data.statistics.averageRating).toBe(4.3);
  });
});

describe("GraphQL – mutations", () => {
  it("createAlbum creates and returns album", async () => {
    const res = await gql(`
      mutation {
        createAlbum(input: {
          title: "New GQL Album"
          artist: "Someone"
          year: 2024
          genre: "Jazz"
          coverUrl: "https://example.com/new.jpg"
        }) { id title }
      }
    `);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createAlbum.title).toBe("New GQL Album");
  });

  it("createAlbum returns validation error for bad input", async () => {
    const res = await gql(`
      mutation {
        createAlbum(input: {
          title: ""
          artist: "X"
          year: 2020
          genre: "Rock"
          coverUrl: "not-a-url"
        }) { id }
      }
    `);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions.code).toBe("VALIDATION_ERROR");
  });

  it("updateAlbum updates fields", async () => {
    const res = await gql(`
      mutation {
        updateAlbum(id: "gql-album", patch: { title: "Updated" }) { title }
      }
    `);
    expect(res.body.data.updateAlbum.title).toBe("Updated");
  });

  it("deleteAlbum returns true", async () => {
    const res = await gql(`mutation { deleteAlbum(id: "gql-album") }`);
    expect(res.body.data.deleteAlbum).toBe(true);
  });

  it("createTrack creates track under album", async () => {
    const res = await gql(`
      mutation {
        createTrack(albumId: "gql-album", input: { title: "New Track", position: 2, durationSec: 150 }) {
          id albumId title
        }
      }
    `);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createTrack.albumId).toBe("gql-album");
  });

  it("deleteTrack returns true", async () => {
    const res = await gql(`mutation { deleteTrack(id: "gql-t1") }`);
    expect(res.body.data.deleteTrack).toBe(true);
  });
});
