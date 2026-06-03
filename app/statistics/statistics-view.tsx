import type { ReactNode } from "react";

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

type StatisticsViewData = {
  genreDistribution: DistributionRow[];
  decadeDistribution: DistributionRow[];
  ratingDistribution: DistributionRow[];
  topRatedAlbums: TopAlbumRow[];
  summary: {
    totalAlbums: number;
    averageRating: number;
    genres: number;
    yearRange: string;
  };
};

type StatisticsViewProps = {
  mode: "visual" | "tabular";
  onModeChange: (mode: "visual" | "tabular") => void;
  data: StatisticsViewData;
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-hover border border-zinc-300 bg-zinc-100 p-5">
      <h2 className="text-xl font-medium text-zinc-800 sm:text-2xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SimpleBars({ rows }: { rows: DistributionRow[] }) {
  const max = rows.reduce((current, row) => Math.max(current, row.count), 1);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex justify-between text-sm text-zinc-700">
            <span>{row.label}</span>
            <span>{row.count}</span>
          </div>
          <div className="h-3 w-full bg-zinc-200">
            <div
              className="h-3 bg-zinc-600 transition-all duration-300"
              style={{ width: `${Math.max((row.count / max) * 100, 3)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DistributionTable({
  heading,
  rows,
}: {
  heading: string;
  rows: DistributionRow[];
}) {
  return (
    <section className="card-hover border border-zinc-300 bg-zinc-100">
      <h2 className="border-b border-zinc-300 px-5 py-4 text-2xl font-medium text-zinc-800">{heading}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-left">
          <thead className="border-b border-zinc-300 text-base text-zinc-800">
            <tr>
              <th className="px-5 py-3 font-medium">Label</th>
              <th className="px-5 py-3 font-medium">Count</th>
              <th className="px-5 py-3 font-medium">Percentage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-zinc-200 text-sm text-zinc-700 md:text-base">
                <td className="px-5 py-3">{row.label}</td>
                <td className="px-5 py-3">{row.count}</td>
                <td className="px-5 py-3">{row.percentage.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PieChart({ rows }: { rows: DistributionRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;

  function getColor(label: string): string {
    const normalized = label.trim().toLowerCase();
    // Pastel / muted palette
    if (normalized === "rock") return "#93c5fd"; // pastel blue
    if (normalized === "metal") return "#fca5a5"; // pastel red
    if (normalized === "jazz") return "#c4b5fd"; // pastel purple
    if (normalized === "r&b" || normalized === "rnb") return "#86efac"; // pastel green
    return "#52525b";
  }

  // Keep a fallback palette if more segments ever appear.
  const fallbackColors = ["#93c5fd", "#fca5a5", "#c4b5fd", "#86efac", "#fde68a"]; // pastel yellow
  let current = 0;

  const segments = rows
    .filter((row) => row.count > 0)
    .map((row, index) => {
      const start = (current / total) * 100;
      current += row.count;
      const end = (current / total) * 100;
      const color = getColor(row.label) || fallbackColors[index % fallbackColors.length];
      return { label: row.label, color, start, end };
    });

  const gradient = segments
    .map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`)
    .join(", ");

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div
        className="h-40 w-40 rounded-full border border-zinc-200 bg-white"
        style={{ backgroundImage: `conic-gradient(${gradient})` }}
        aria-label="Pie chart showing genre distribution"
      />
      <div className="space-y-2 text-sm text-zinc-700">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: segment.color }} />
            <span>{segment.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatisticsView({ mode, onModeChange, data }: StatisticsViewProps) {
  return (
    <div className="page-enter">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-medium text-zinc-900">Database Statistics</h1>

        <div className="flex items-center gap-2 border border-zinc-300 bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => onModeChange("visual")}
            className={mode === "visual" ? "bg-zinc-700 px-4 py-2 text-zinc-100" : "px-4 py-2 text-zinc-700"}
          >
            Visual
          </button>
          <button
            type="button"
            onClick={() => onModeChange("tabular")}
            className={mode === "tabular" ? "bg-zinc-700 px-4 py-2 text-zinc-100" : "px-4 py-2 text-zinc-700"}
          >
            Tabular
          </button>
        </div>
      </div>

      {mode === "visual" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Genre Distribution">
            <PieChart rows={data.genreDistribution} />
          </Card>

          <Card title="Albums by Decade">
            <SimpleBars rows={data.decadeDistribution} />
          </Card>

          <Card title="Rating Distribution">
            <SimpleBars rows={data.ratingDistribution} />
          </Card>

          <section className="card-hover border border-zinc-300 bg-zinc-100 p-5">
            <h2 className="text-xl font-medium text-zinc-800 sm:text-2xl">Top Rated Albums</h2>
            <div className="mt-4 space-y-3">
              {data.topRatedAlbums.map((album) => (
                <div key={album.title} className="card-hover flex items-center gap-3 border border-zinc-200 bg-white p-2">
                  <span className="w-9 bg-zinc-700 px-2 py-1 text-center text-sm text-zinc-100">#{album.rank}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={album.coverUrl} alt={`${album.title} cover`} className="h-10 w-10 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-800">{album.title}</p>
                    <p className="text-xs text-zinc-500">{album.artist}</p>
                  </div>
                  <p className="text-sm text-zinc-700">★ {album.rating.toFixed(1)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <DistributionTable heading="Genre Distribution" rows={data.genreDistribution} />
          <DistributionTable heading="Albums by Decade" rows={data.decadeDistribution} />
          <DistributionTable heading="Rating Distribution" rows={data.ratingDistribution} />

          <section className="card-hover border border-zinc-300 bg-zinc-100">
            <h2 className="border-b border-zinc-300 px-5 py-4 text-2xl font-medium text-zinc-800">Top Rated Albums</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left">
                <thead className="border-b border-zinc-300 text-base text-zinc-800">
                  <tr>
                    <th className="px-5 py-3 font-medium">Rank</th>
                    <th className="px-5 py-3 font-medium">Album</th>
                    <th className="px-5 py-3 font-medium">Artist</th>
                    <th className="px-5 py-3 font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topRatedAlbums.map((album) => (
                    <tr key={album.title} className="border-b border-zinc-200 text-sm text-zinc-700 md:text-base">
                      <td className="px-5 py-3">#{album.rank}</td>
                      <td className="px-5 py-3">{album.title}</td>
                      <td className="px-5 py-3">{album.artist}</td>
                      <td className="px-5 py-3">{album.rating.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-hover border border-zinc-300 bg-zinc-100 p-5">
          <p className="text-sm text-zinc-500">Total Albums</p>
          <p className="mt-2 text-3xl text-zinc-900 sm:text-4xl">{data.summary.totalAlbums}</p>
        </div>
        <div className="card-hover border border-zinc-300 bg-zinc-100 p-5">
          <p className="text-sm text-zinc-500">Average Rating</p>
          <p className="mt-2 text-3xl text-zinc-900 sm:text-4xl">{data.summary.averageRating}</p>
        </div>
        <div className="card-hover border border-zinc-300 bg-zinc-100 p-5">
          <p className="text-sm text-zinc-500">Genres</p>
          <p className="mt-2 text-3xl text-zinc-900 sm:text-4xl">{data.summary.genres}</p>
        </div>
        <div className="card-hover border border-zinc-300 bg-zinc-100 p-5">
          <p className="text-sm text-zinc-500">Year Range</p>
          <p className="mt-2 text-3xl text-zinc-900 sm:text-4xl">{data.summary.yearRange}</p>
        </div>
      </section>
    </div>
  );
}


