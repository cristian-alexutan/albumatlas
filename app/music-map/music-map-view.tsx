import { genreNodes } from "@/app/music-map/music-map-logic";
import type { Album } from "@/lib/types";

type MusicMapViewProps = {
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  visibleAlbums: Album[];
  clickCounts?: Record<string, number>;
};

function getNodeStyles(isActive: boolean): string {
  if (isActive) {
    return "border-zinc-700 bg-zinc-600 text-zinc-100 shadow-sm";
  }

  return "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200";
}

export function MusicMapView({ selectedNodeId, onNodeSelect, visibleAlbums, clickCounts = {} }: MusicMapViewProps) {
  const selectedLabel = genreNodes.find((node) => node.id === selectedNodeId)?.label;

  return (
    <div className="page-enter">
      <h1 className="text-3xl font-medium text-zinc-900 sm:text-4xl">Music Map</h1>
      <p className="mt-2 text-base text-zinc-600 sm:text-lg">
        Explore albums through an interactive map of music genres. Click on a genre to discover albums.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="relative h-[520px] overflow-hidden border border-zinc-300 bg-zinc-100 p-4 sm:h-[640px]">
          {genreNodes.map((node) => {
            const parent = genreNodes.find((candidate) => candidate.id === node.parentId);

            return (
              <div key={node.id}>
                {parent ? (
                  <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden="true">
                    <line
                      x1={`${parent.x}%`}
                      y1={`${parent.y}%`}
                      x2={`${node.x}%`}
                      y2={`${node.y}%`}
                      stroke="#c4c4c0"
                      strokeWidth="2"
                    />
                  </svg>
                ) : null}

                <button
                  type="button"
                  onClick={() => onNodeSelect(node.id)}
                  className={`card-hover absolute z-10 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border text-xs transition-colors sm:h-24 sm:w-24 sm:text-sm ${getNodeStyles(selectedNodeId === node.id)}`}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  data-node-id={node.id}
                >
                  {node.label}
                  {clickCounts[node.id] ? (
                    <span
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-white"
                      data-testid={`click-count-${node.id}`}
                    >
                      {clickCounts[node.id]}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </section>

        <section className="border border-zinc-300 bg-zinc-100 p-5" data-testid="album-sidebar">
          {selectedNodeId ? (
            <>
              <h2 className="text-2xl font-medium text-zinc-900 sm:text-3xl">{selectedLabel}</h2>

              <div className="mt-4 max-h-[520px] space-y-4 overflow-auto pr-1">
                {visibleAlbums.length ? (
                  visibleAlbums.map((album) => (
                    <article
                      key={album.id}
                      className="card-hover border border-zinc-300 bg-zinc-100 p-3 transition-shadow hover:shadow-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={album.coverUrl} alt={`${album.title} cover`} className="aspect-square w-full object-cover" />
                      <h3 className="mt-2 text-lg text-zinc-900">{album.title}</h3>
                      <p className="text-base text-zinc-600">{album.artist}</p>
                      <p className="mt-1 text-base text-zinc-700">★ {album.rating.toFixed(1)}</p>
                    </article>
                  ))
                ) : (
                  <p className="text-zinc-600">No albums found for this genre.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-base text-zinc-600 sm:text-lg">Click on a genre node to explore albums</p>
          )}
        </section>
      </div>

      {Object.keys(clickCounts).length > 0 ? (
        <section className="mt-6 border border-zinc-300 bg-zinc-100 p-5" data-testid="activity-summary">
          <h2 className="text-xl font-medium text-zinc-800">Your Exploration Activity</h2>
          <p className="mt-1 text-sm text-zinc-500">Genre click counts tracked via browser cookies</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {genreNodes
              .filter((node) => clickCounts[node.id])
              .sort((a, b) => (clickCounts[b.id] ?? 0) - (clickCounts[a.id] ?? 0))
              .map((node) => (
                <div
                  key={node.id}
                  className="flex items-center justify-between border border-zinc-200 bg-white px-4 py-3"
                  data-testid={`activity-${node.id}`}
                >
                  <span className="text-sm text-zinc-700">{node.label}</span>
                  <span className="text-sm font-medium text-zinc-900">{clickCounts[node.id]} clicks</span>
                </div>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
