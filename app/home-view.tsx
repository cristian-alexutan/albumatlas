import Link from "next/link";
import { SiteHeader } from "@/app/components/site-header";

export function HomeView() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <SiteHeader />

      <main className="mx-auto max-w-[1600px] px-6 py-14 text-center">
        <section className="mx-auto flex max-w-3xl flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Album Atlas"
            className="w-full max-w-[420px] h-auto"
          />

          <h1 className="mt-1 text-2xl font-normal text-zinc-600">Discover, Rate, and Catalog Music Albums</h1>

          <p className="mt-14 max-w-[980px] text-lg leading-snug text-zinc-600">
            A comprehensive music database where enthusiasts can explore, rate, and catalog albums from all genres and
            eras. Join our community of music lovers and build your personal collection while discovering new music.
          </p>

          <Link
            href="/browse"
            className="mt-12 inline-flex items-center justify-center bg-zinc-700 px-12 py-3 text-lg font-medium text-zinc-100 transition-colors hover:bg-zinc-800"
          >
            Browse Albums
          </Link>
        </section>

        <div className="mt-16 border-t border-zinc-300" />
      </main>
    </div>
  );
}

