import Link from "next/link";
import { DeleteAlbumButton } from "@/app/components/delete-album-button";
import { TracksPanel } from "@/app/components/tracks-panel";
import { ReviewsPanel } from "@/app/components/reviews-panel";
import type { Album } from "@/lib/api-client";

type AlbumDetailViewProps = {
  album: Album;
  canManageAlbum: boolean;
};

export function AlbumDetailView({ album, canManageAlbum }: AlbumDetailViewProps) {
  return (
    <div className="border border-zinc-300 bg-zinc-100 p-6">
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={album.coverUrl}
          alt={`${album.title} cover`}
          className="h-[420px] w-full border border-zinc-300 object-cover"
        />

        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">{album.title}</h1>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-base text-zinc-700 md:text-lg">
            <dt>Artist:</dt>
            <dd>{album.artist}</dd>

            <dt>Year:</dt>
            <dd>{album.year}</dd>

            <dt>Genre:</dt>
            <dd>{album.genre}</dd>

            <dt>Rating:</dt>
            <dd>{album.rating.toFixed(1)} / 5.0</dd>
          </dl>

          {canManageAlbum && (
            <div className="mt-7 flex items-center gap-4">
              <Link
                href={`/albums/${album.id}/edit`}
                className="bg-zinc-700 px-6 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 md:text-base"
              >
                Edit Album
              </Link>
              <DeleteAlbumButton albumId={album.id} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-7 border-t border-zinc-300 pt-6">
        <h2 className="text-xl font-medium text-zinc-900">Description</h2>
        <p className="mt-3 text-base leading-relaxed text-zinc-700 md:text-lg">
          {album.description}
        </p>
      </div>

      <TracksPanel albumId={album.id} canManage={canManageAlbum} />

      <ReviewsPanel albumId={album.id} />
    </div>
  );
}
