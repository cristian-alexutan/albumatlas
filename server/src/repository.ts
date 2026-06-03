import type {
  Album,
  AlbumInput,
  AlbumPatch,
  Page,
  PageQuery,
  Track,
  TrackInput,
  TrackPatch,
} from "./types.js";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export class AlbumRepository {
  private albums: Map<string, Album> = new Map();
  private tracks: Map<string, Track> = new Map();

  reset(albums: Album[] = [], tracks: Track[] = []) {
    this.albums = new Map(albums.map((a) => [a.id, { ...a }]));
    this.tracks = new Map(tracks.map((t) => [t.id, { ...t }]));
  }

  private uniqueAlbumId(title: string): string {
    const base = slugify(title) || "album";
    if (!this.albums.has(base)) return base;
    let counter = 1;
    while (this.albums.has(`${base}-${counter}`)) counter += 1;
    return `${base}-${counter}`;
  }

  private uniqueTrackId(albumId: string, title: string, position: number): string {
    const base = `${albumId}-${slugify(title) || `track-${position}`}`;
    if (!this.tracks.has(base)) return base;
    return `${base}-${randomSuffix()}`;
  }

  listAlbums(query: PageQuery): Page<Album> {
    let items = Array.from(this.albums.values());

    if (query.search) {
      const needle = query.search.toLowerCase();
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(needle) ||
          a.artist.toLowerCase().includes(needle),
      );
    }

    if (query.genre) {
      const g = query.genre.toLowerCase();
      items = items.filter((a) => a.genre.toLowerCase() === g);
    }

    if (query.sort) {
      const dir = query.order === "desc" ? -1 : 1;
      const key = query.sort;
      items.sort((a, b) => {
        const av = a[key] as string | number;
        const bv = b[key] as string | number;
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const start = (query.page - 1) * query.pageSize;
    const paged = items.slice(start, start + query.pageSize);

    return {
      items: paged,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
    };
  }

  allAlbums(): Album[] {
    return Array.from(this.albums.values());
  }

  getAlbum(id: string): Album | undefined {
    const album = this.albums.get(id);
    return album ? { ...album } : undefined;
  }

  createAlbum(input: AlbumInput): Album {
    const id = this.uniqueAlbumId(input.title);
    const album: Album = { id, ...input };
    this.albums.set(id, album);
    return { ...album };
  }

  updateAlbum(id: string, patch: AlbumPatch): Album | undefined {
    const existing = this.albums.get(id);
    if (!existing) return undefined;
    const updated: Album = { ...existing, ...patch };
    this.albums.set(id, updated);
    return { ...updated };
  }

  deleteAlbum(id: string): boolean {
    if (!this.albums.has(id)) return false;
    this.albums.delete(id);
    for (const [trackId, track] of this.tracks) {
      if (track.albumId === id) this.tracks.delete(trackId);
    }
    return true;
  }

  listTracksByAlbum(albumId: string): Track[] {
    return Array.from(this.tracks.values())
      .filter((t) => t.albumId === albumId)
      .sort((a, b) => a.position - b.position)
      .map((t) => ({ ...t }));
  }

  getTrack(trackId: string): Track | undefined {
    const track = this.tracks.get(trackId);
    return track ? { ...track } : undefined;
  }

  createTrack(albumId: string, input: TrackInput): Track | undefined {
    if (!this.albums.has(albumId)) return undefined;
    const id = this.uniqueTrackId(albumId, input.title, input.position);
    const track: Track = { id, albumId, ...input };
    this.tracks.set(id, track);
    return { ...track };
  }

  updateTrack(trackId: string, patch: TrackPatch): Track | undefined {
    const existing = this.tracks.get(trackId);
    if (!existing) return undefined;
    const updated: Track = { ...existing, ...patch };
    this.tracks.set(trackId, updated);
    return { ...updated };
  }

  deleteTrack(trackId: string): Track | undefined {
    const existing = this.tracks.get(trackId);
    if (!existing) return undefined;
    this.tracks.delete(trackId);
    return { ...existing };
  }
}

export const repository = new AlbumRepository();
