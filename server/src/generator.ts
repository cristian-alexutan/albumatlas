import { faker } from "@faker-js/faker";
import { service } from "./service.js";
import { eventBus } from "./events.js";
import type { AlbumInput, TrackInput } from "./types.js";

const GENRES = [
  "Rock", "Pop", "Jazz", "Classical", "Hip-Hop", "Electronic",
  "R&B", "Country", "Reggae", "Metal", "Folk", "Soul", "Blues",
  "Alternative Rock", "Progressive Rock", "Indie",
];

const BATCH_SIZE = 3;
const INTERVAL_MS = 5_000;

let timerId: ReturnType<typeof setInterval> | null = null;

function generateAlbum(): AlbumInput {
  return {
    title: faker.music.songName(),
    artist: faker.person.fullName(),
    year: faker.number.int({ min: 1960, max: new Date().getFullYear() }),
    genre: faker.helpers.arrayElement(GENRES),
    coverUrl: `https://picsum.photos/seed/${faker.string.alphanumeric(8)}/300/300`,
    description: faker.lorem.sentences(2),
    rating: Number(faker.number.float({ min: 1, max: 5, fractionDigits: 1 })),
    featured: faker.datatype.boolean({ probability: 0.2 }),
  };
}

function generateTrack(albumId: string, position: number): TrackInput {
  return {
    title: faker.music.songName(),
    position,
    durationSec: faker.number.int({ min: 90, max: 600 }),
  };
}

function runBatch() {
  for (let i = 0; i < BATCH_SIZE; i++) {
    const album = service.createAlbum(generateAlbum());
    const trackCount = faker.number.int({ min: 4, max: 14 });
    for (let pos = 1; pos <= trackCount; pos++) {
      service.createTrack(album.id, generateTrack(album.id, pos));
    }
  }
  // "batch done" signal — clients update UI
  eventBus.emitDomain({ type: "generator.started" });
}

export const generator = {
  get running() {
    return timerId !== null;
  },

  start() {
    if (timerId !== null) return false;
    runBatch(); // immediate first batch
    timerId = setInterval(runBatch, INTERVAL_MS);
    return true;
  },

  stop() {
    if (timerId === null) return false;
    clearInterval(timerId);
    timerId = null;
    eventBus.emitDomain({ type: "generator.stopped" });
    return true;
  },
};
