import type { Album } from "@/lib/types";

type DistributionRow = {
  label: string;
  count: number;
  percentage: number;
};

type TopAlbumRow = {
  rank: number;
  title: string;
  artist: string;
  rating: number;
  coverUrl: string;
};

type StatsSummary = {
  totalAlbums: number;
  averageRating: number;
  genres: number;
  yearRange: string;
};

export type StatisticsData = {
  genreDistribution: DistributionRow[];
  decadeDistribution: DistributionRow[];
  ratingDistribution: DistributionRow[];
  topRatedAlbums: TopAlbumRow[];
  summary: StatsSummary;
};

function toPercentage(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Number(((count / total) * 100).toFixed(1));
}

function toDecadeLabel(year: number): string {
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

function countBy(values: string[]): DistributionRow[] {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  const total = values.length;

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: toPercentage(count, total),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function toGenreBucket(genre: string): string {
  const normalized = genre.trim().toLowerCase();

  // Rock bucket (includes many rock subgenres)
  if (normalized.includes("rock")) {
    return "Rock";
  }

  // Metal bucket
  if (normalized.includes("metal")) {
    return "Metal";
  }

  // Jazz bucket
  if (normalized.includes("jazz")) {
    return "Jazz";
  }

  // R&B bucket (accept common variations)
  if (normalized.includes("r&b") || normalized.includes("rnb") || normalized.includes("r and b") || normalized.includes("rnb")) {
    return "R&B";
  }

  // Default: treat anything else as Rock for this assignment split
  return "Rock";
}

function getRatingBucket(rating: number): string {
  if (rating >= 4.5) {
    return "4.5-5.0";
  }
  if (rating >= 4.0) {
    return "4.0-4.4";
  }
  if (rating >= 3.5) {
    return "3.5-3.9";
  }
  if (rating >= 3.0) {
    return "3.0-3.4";
  }
  return "Below 3.0";
}

export function getStatisticsData(albums: Album[]): StatisticsData {
  const genreDistribution = countBy(albums.map((album) => toGenreBucket(album.genre)));
  const decadeDistribution = countBy(albums.map((album) => toDecadeLabel(album.year))).sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  const ratingOrder = ["4.5-5.0", "4.0-4.4", "3.5-3.9", "3.0-3.4", "Below 3.0"];
  const ratingsCount = new Map<string, number>();
  ratingOrder.forEach((bucket) => ratingsCount.set(bucket, 0));

  albums.forEach((album) => {
    const bucket = getRatingBucket(album.rating);
    ratingsCount.set(bucket, (ratingsCount.get(bucket) || 0) + 1);
  });

  const ratingDistribution = ratingOrder.map((bucket) => {
    const count = ratingsCount.get(bucket) || 0;
    return {
      label: bucket,
      count,
      percentage: toPercentage(count, albums.length),
    };
  });

  const topRatedAlbums = [...albums]
    .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title))
    .slice(0, 10)
    .map((album, index) => ({
      rank: index + 1,
      title: album.title,
      artist: album.artist,
      rating: album.rating,
      coverUrl: album.coverUrl,
    }));

  const years = albums.map((album) => album.year);
  const minYear = years.length ? Math.min(...years) : 0;
  const maxYear = years.length ? Math.max(...years) : 0;
  const ratingsTotal = albums.reduce((sum, album) => sum + album.rating, 0);

  const summary: StatsSummary = {
    totalAlbums: albums.length,
    averageRating: albums.length ? Number((ratingsTotal / albums.length).toFixed(2)) : 0,
    genres: genreDistribution.length,
    yearRange: years.length ? `${minYear}-${maxYear}` : "N/A",
  };

  return {
    genreDistribution,
    decadeDistribution,
    ratingDistribution,
    topRatedAlbums,
    summary,
  };
}

