import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Album, Track } from "./types.js";
import { AlbumRepository } from "./repository.js";

type SeedAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  coverUrl: string;
  description: string;
  rating: number;
  tracks: string[];
  featured?: boolean;
};

function approxTrackDuration(title: string): number {
  const base = 150;
  const variance = (title.length * 17) % 180;
  return base + variance;
}

export function loadSeed(): { albums: Album[]; tracks: Track[] } {
  const here = dirname(fileURLToPath(import.meta.url));
  const seedPath = resolve(here, "../data/albums.json");
  const raw = readFileSync(seedPath, "utf-8");
  const seed: SeedAlbum[] = JSON.parse(raw);

  const albums: Album[] = seed.map((a) => ({
    id: a.id,
    title: a.title,
    artist: a.artist,
    year: a.year,
    genre: a.genre,
    coverUrl: a.coverUrl,
    description: a.description,
    rating: 0,
    featured: a.featured ?? false,
  }));

  const tracks: Track[] = seed.flatMap((album) =>
    album.tracks.map((title, i) => ({
      id: `${album.id}-track-${i + 1}`,
      albumId: album.id,
      title,
      position: i + 1,
      durationSec: approxTrackDuration(title),
    })),
  );

  return { albums, tracks };
}

export function seedRepository(repo: AlbumRepository) {
  const { albums, tracks } = loadSeed();
  repo.reset(albums, tracks);
}
