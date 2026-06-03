import Link from "next/link";
import { AlbumPageLayout } from "@/app/albums/album-page-layout";

export function AlbumNotFoundView() {
  return (
    <AlbumPageLayout
      backLink={
        <Link href="/browse" className="text-base text-zinc-600 hover:underline">
          ← Back to album list
        </Link>
      }
    >
      <p className="text-base text-zinc-700">Album not found in the current session.</p>
    </AlbumPageLayout>
  );
}

