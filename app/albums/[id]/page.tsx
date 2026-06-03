"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlbumPageLayout } from "@/app/albums/album-page-layout";
import { AlbumDetailView } from "@/app/albums/[id]/album-detail-view";
import { AlbumNotFoundView } from "@/app/albums/album-not-found-view";
import { useAlbums } from "@/app/components/albums-provider";
import { useAuth } from "@/app/components/auth-provider";

export default function AlbumDetailPage() {
  const params = useParams<{ id: string }>();
  const albumIdParam = params.id;
  const albumId = Array.isArray(albumIdParam) ? albumIdParam[0] : albumIdParam;
  const { getAlbumById } = useAlbums();
  const { currentUser } = useAuth();
  const album = getAlbumById(albumId);

  const [allowNotFound, setAllowNotFound] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setAllowNotFound(true);
    }, 400);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [albumId]);

  if (!album && !allowNotFound) {
    return (
      <AlbumPageLayout
        backLink={<Link href="/browse" className="text-base text-zinc-600 hover:underline">← Back to album list</Link>}
      >
        <div className="py-20 text-center text-zinc-500">Loading…</div>
      </AlbumPageLayout>
    );
  }

  if (!album) return <AlbumNotFoundView />;

  return (
    <AlbumPageLayout
      backLink={
        <Link href="/browse" className="text-base text-zinc-600 hover:underline">
          ← Back to album list
        </Link>
      }
    >
      <AlbumDetailView album={album} canManageAlbum={currentUser?.role === "admin"} />
    </AlbumPageLayout>
  );
}
