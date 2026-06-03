const envApiBase = process.env.NEXT_PUBLIC_API_URL;
const internalApiBase = process.env.INTERNAL_API_URL;
const resolvedApiBase = envApiBase && envApiBase.trim().length > 0 ? envApiBase : undefined;
const resolvedInternalBase =
  internalApiBase && internalApiBase.trim().length > 0 ? internalApiBase : undefined;

export const API_BASE =
  (typeof window === "undefined"
    ? resolvedInternalBase ?? resolvedApiBase ?? "http://localhost:4000"
    : resolvedApiBase ?? "");
const GQL_URL = `${API_BASE}/graphql`;

export type Album = {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  coverUrl: string;
  description: string;
  rating: number;
  featured: boolean;
};

export type Track = {
  id: string;
  albumId: string;
  title: string;
  position: number;
  durationSec: number;
};

export type AlbumInput = Omit<Album, "id">;
export type TrackInput = Omit<Track, "id" | "albumId">;

export type AlbumsPage = {
  items: Album[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Statistics = {
  albumCount: number;
  averageRating: number;
  byGenre: { genre: string; albumCount: number }[];
  byDecade: { decade: string; albumCount: number }[];
  topRated: Album[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly validationErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors?.length) {
    const first = json.errors[0];
    throw new ApiError(
      first.message,
      res.status,
      first.extensions?.errors,
    );
  }

  return json.data as T;
}

const ALBUM_FIELDS = `
  id title artist year genre coverUrl description rating featured
`;

export async function fetchAlbumsPage(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  genre?: string;
  sort?: string;
  order?: string;
}): Promise<AlbumsPage> {
  const data = await gql<{ albums: AlbumsPage }>(
    `query ListAlbums(
      $page: Int, $pageSize: Int, $search: String, $genre: String,
      $sort: AlbumSort, $order: SortOrder
    ) {
      albums(page: $page, pageSize: $pageSize, search: $search, genre: $genre,
             sort: $sort, order: $order) {
        items { ${ALBUM_FIELDS} }
        page pageSize total totalPages
      }
    }`,
    params,
  );
  return data.albums;
}

export async function fetchAllAlbums(): Promise<Album[]> {
  const page = await fetchAlbumsPage({ page: 1, pageSize: 1000 });
  return page.items;
}

export async function fetchAlbum(id: string): Promise<Album | null> {
  const data = await gql<{ album: Album | null }>(
    `query GetAlbum($id: ID!) { album(id: $id) { ${ALBUM_FIELDS} } }`,
    { id },
  );
  return data.album;
}

export async function createAlbum(input: AlbumInput): Promise<Album> {
  const data = await gql<{ createAlbum: Album }>(
    `mutation CreateAlbum($input: AlbumInput!) {
      createAlbum(input: $input) { ${ALBUM_FIELDS} }
    }`,
    { input },
  );
  return data.createAlbum;
}

export async function updateAlbum(
  id: string,
  patch: Partial<AlbumInput>,
): Promise<Album> {
  const data = await gql<{ updateAlbum: Album }>(
    `mutation UpdateAlbum($id: ID!, $patch: AlbumPatch!) {
      updateAlbum(id: $id, patch: $patch) { ${ALBUM_FIELDS} }
    }`,
    { id, patch },
  );
  return data.updateAlbum;
}

export async function deleteAlbum(id: string): Promise<boolean> {
  const data = await gql<{ deleteAlbum: boolean }>(
    `mutation DeleteAlbum($id: ID!) { deleteAlbum(id: $id) }`,
    { id },
  );
  return data.deleteAlbum;
}

const TRACK_FIELDS = `id albumId title position durationSec`;

export async function fetchTracks(albumId: string): Promise<Track[]> {
  const data = await gql<{ tracks: Track[] | null }>(
    `query GetTracks($albumId: ID!) { tracks(albumId: $albumId) { ${TRACK_FIELDS} } }`,
    { albumId },
  );
  return data.tracks ?? [];
}

export async function createTrack(
  albumId: string,
  input: TrackInput,
): Promise<Track> {
  const data = await gql<{ createTrack: Track }>(
    `mutation CreateTrack($albumId: ID!, $input: TrackInput!) {
      createTrack(albumId: $albumId, input: $input) { ${TRACK_FIELDS} }
    }`,
    { albumId, input },
  );
  return data.createTrack;
}

export async function updateTrack(
  id: string,
  patch: Partial<TrackInput>,
): Promise<Track> {
  const data = await gql<{ updateTrack: Track }>(
    `mutation UpdateTrack($id: ID!, $patch: TrackPatch!) {
      updateTrack(id: $id, patch: $patch) { ${TRACK_FIELDS} }
    }`,
    { id, patch },
  );
  return data.updateTrack;
}

export async function deleteTrack(id: string): Promise<boolean> {
  const data = await gql<{ deleteTrack: boolean }>(
    `mutation DeleteTrack($id: ID!) { deleteTrack(id: $id) }`,
    { id },
  );
  return data.deleteTrack;
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export type Review = {
  id:        string;
  albumId:   string;
  userId:    string;
  username:  string;
  rating:    number;
  comment:   string;
  createdAt: string;
};

export async function fetchReviews(albumId: string): Promise<Review[]> {
  const res = await fetch(`${API_BASE}/api/albums/${albumId}/reviews`, {
    credentials: "include",
  });
  if (!res.ok) throw new ApiError("Failed to fetch reviews", res.status);
  return res.json() as Promise<Review[]>;
}

export async function createReview(
  albumId: string,
  input: { rating: number; comment: string },
): Promise<Review> {
  const res = await fetch(`${API_BASE}/api/albums/${albumId}/reviews`, {
    method:      "POST",
    credentials: "include",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new ApiError(body.error ?? "Failed to create review", res.status);
  }
  return res.json() as Promise<Review>;
}

export async function deleteReview(albumId: string, reviewId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/albums/${albumId}/reviews/${reviewId}`, {
    method:      "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    throw new ApiError("Failed to delete review", res.status);
  }
}

export async function fetchStatistics(): Promise<Statistics> {
  const data = await gql<{ statistics: Statistics }>(
    `query {
      statistics {
        albumCount averageRating
        byGenre { genre albumCount }
        byDecade { decade albumCount }
        topRated { ${ALBUM_FIELDS} }
      }
    }`,
  );
  return data.statistics;
}


export async function startGenerator(): Promise<void> {
  await gql(`mutation { startGenerator { running } }`);
}

export async function stopGenerator(): Promise<void> {
  await gql(`mutation { stopGenerator { running } }`);
}

export async function fetchGeneratorStatus(): Promise<{ running: boolean }> {
  const data = await gql<{ generatorStatus: { running: boolean } }>(
    `query { generatorStatus { running } }`,
  );
  return data.generatorStatus;
}
