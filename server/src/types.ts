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
export type AlbumPatch = Partial<AlbumInput>;

export type TrackInput = Omit<Track, "id" | "albumId">;
export type TrackPatch = Partial<TrackInput>;

export type PageQuery = {
  page: number;
  pageSize: number;
  search?: string;
  genre?: string;
  sort?: "title" | "year" | "rating" | "artist";
  order?: "asc" | "desc";
};

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DomainEvent =
  | { type: "album.created"; album: Album }
  | { type: "album.updated"; album: Album }
  | { type: "album.deleted"; albumId: string }
  | { type: "track.created"; track: Track }
  | { type: "track.updated"; track: Track }
  | { type: "track.deleted"; trackId: string; albumId: string }
  | { type: "generator.started" }
  | { type: "generator.stopped" };
