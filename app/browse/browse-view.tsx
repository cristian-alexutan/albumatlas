import Link from "next/link";
import type { BrowseData } from "@/app/browse/browse-logic";
import { getPageButtonClass } from "@/app/browse/browse-logic";

type BrowseViewProps = {
  qFromUrl: string;
  data: BrowseData;
  canManageAlbums: boolean;
};

export function BrowseView({ qFromUrl, data, canManageAlbums }: BrowseViewProps) {
  return (
    <div className="page-enter">
      <section className="border border-zinc-300 bg-zinc-100 p-6">
        <h1 className="mb-6 text-center text-2xl font-medium text-zinc-800">Featured Albums</h1>

        <div className="grid gap-6 lg:grid-cols-3">
          {data.featuredAlbums.map((album) => (
            <article key={album.id} className="card-hover border border-zinc-300 bg-zinc-100 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={album.coverUrl}
                alt={`${album.title} cover`}
                className="aspect-square w-full border border-zinc-200 bg-white object-contain"
              />
              <h2 className="mt-3 text-xl font-medium text-zinc-800">{album.title}</h2>
              <p className="mt-1 text-base text-zinc-600">{album.artist}</p>
              <p className="mt-3 text-base text-zinc-600">★ {album.rating.toFixed(1)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-medium text-zinc-800">Album Database</h2>
          {canManageAlbums ? (
            <Link
              href="/albums/new"
              className="bg-zinc-700 px-5 py-2.5 text-base font-medium text-zinc-100 transition-colors hover:bg-zinc-800"
            >
              Add Album
            </Link>
          ) : null}
        </div>

        <form action="/browse" className="mb-4 max-w-2xl">
          <input
            type="search"
            name="q"
            defaultValue={qFromUrl}
            placeholder="Search by album or artist..."
            className="h-11 w-full border border-zinc-300 bg-white px-4 text-sm text-zinc-700 outline-none focus:border-zinc-500"
          />
        </form>

        <div className="overflow-x-auto border border-zinc-300 bg-zinc-100">
          <table className="w-full min-w-[860px] text-left">
            <thead className="border-b border-zinc-300 text-base text-zinc-800">
              <tr>
                <th className="px-5 py-4 font-medium">Cover</th>
                <th className="px-5 py-4 font-medium">Album Name</th>
                <th className="px-5 py-4 font-medium">Artist</th>
                <th className="px-5 py-4 font-medium">Year</th>
                <th className="px-5 py-4 font-medium">Average Rating</th>
              </tr>
            </thead>
            <tbody>
              {data.visibleAlbums.map((album) => (
                <tr key={album.id} className="border-b border-zinc-200 text-sm text-zinc-700 transition-colors hover:bg-white md:text-base">
                  <td className="px-5 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={album.coverUrl} alt={`${album.title} cover`} className="h-14 w-14 object-cover" />
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/albums/${album.id}`} className="hover:underline">
                      {album.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{album.artist}</td>
                  <td className="px-5 py-3">{album.year}</td>
                  <td className="px-5 py-3">{album.rating.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
          <p>
            Showing {data.showingFrom} to {data.showingTo} of {data.filteredCount} albums
          </p>

          <div className="flex items-center gap-3">
            <Link
              href={data.buildPageLink(data.previousPage)}
              className="border border-zinc-300 bg-white px-4 py-2 disabled:pointer-events-none"
              aria-disabled={data.currentPage <= 1}
            >
              Previous
            </Link>

            {data.pageNumbers.map((pageNumber) => (
              <Link
                key={pageNumber}
                href={data.buildPageLink(pageNumber)}
                className={getPageButtonClass(pageNumber, data.currentPage)}
              >
                {pageNumber}
              </Link>
            ))}

            <Link
              href={data.buildPageLink(data.nextPage)}
              className="border border-zinc-300 bg-white px-4 py-2 disabled:pointer-events-none"
              aria-disabled={data.currentPage >= data.totalPages}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
