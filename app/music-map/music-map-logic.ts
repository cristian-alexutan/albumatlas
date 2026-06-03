import type { Album } from "@/lib/types";

export type GenreNode = {
  id: string;
  label: string;
  parentId: string | null;
  x: number;
  y: number;
};

export const genreNodes: GenreNode[] = [
  { id: "rock", label: "Rock", parentId: null, x: 44, y: 24 },
  { id: "progressive-rock", label: "Progressive Rock", parentId: "rock", x: 26, y: 12 },
  { id: "hard-rock", label: "Hard Rock", parentId: "rock", x: 58, y: 18 },
  { id: "metal", label: "Metal", parentId: "hard-rock", x: 74, y: 12 },
  { id: "alternative-rock", label: "Alternative Rock", parentId: "rock", x: 68, y: 32 },
  { id: "indie", label: "Indie", parentId: "alternative-rock", x: 82, y: 42 },
  { id: "glam-rock", label: "Glam Rock", parentId: "rock", x: 52, y: 38 },
  { id: "soft-rock", label: "Soft Rock", parentId: "rock", x: 30, y: 48 },
  { id: "jazz", label: "Jazz", parentId: "soft-rock", x: 15, y: 42 },
  { id: "rnb", label: "R&B", parentId: null, x: 60, y: 56 },
  { id: "alternative-rnb", label: "Alternative R&B", parentId: "rnb", x: 76, y: 60 },
];

const genreAliases: Record<string, string> = {
  rock: "rock",
  "progressive rock": "progressive-rock",
  "hard rock": "hard-rock",
  metal: "metal",
  "alternative rock": "alternative-rock",
  indie: "indie",
  "glam rock": "glam-rock",
  "soft rock": "soft-rock",
  jazz: "jazz",
  "r&b": "rnb",
  "alternative r&b": "alternative-rnb",
};

function normalizeGenre(genre: string): string {
  return genre.trim().toLowerCase();
}

function getDescendants(parentId: string): string[] {
  const descendants: string[] = [];

  function walk(nodeId: string) {
    genreNodes.forEach((node) => {
      if (node.parentId === nodeId) {
        descendants.push(node.id);
        walk(node.id);
      }
    });
  }

  walk(parentId);
  return descendants;
}

export function getAlbumsForGenreSelection(albums: Album[], selectedNodeId: string | null): Album[] {
  if (!selectedNodeId) {
    return [];
  }

  const validNodeIds = [selectedNodeId, ...getDescendants(selectedNodeId)];

  return albums.filter((album) => {
    const normalized = normalizeGenre(album.genre);
    const mapped = genreAliases[normalized];
    if (!mapped) {
      return false;
    }

    return validNodeIds.includes(mapped);
  });
}

