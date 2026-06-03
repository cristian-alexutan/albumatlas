"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlbumPageLayout } from "@/app/albums/album-page-layout";
import { AlbumForm } from "@/app/components/album-form";
import { useAlbums } from "@/app/components/albums-provider";
import { useAuth } from "@/app/components/auth-provider";
import { useEffect, useState } from "react";

export default function EditAlbumPage() {
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
        backLink={
          <Link href="/browse" className="text-base text-zinc-600 hover:underline">
            ← Back to album list
          </Link>
        }
      >
        <div className="py-20 text-center text-zinc-500">Loading…</div>
      </AlbumPageLayout>
    );
  }

  if (!album) {
    return (
      <AlbumPageLayout
        backLink={
          <Link href="/browse" className="text-base text-zinc-600 hover:underline">
            ← Back to album list
          </Link>
        }
      >
        <section className="border border-zinc-300 bg-zinc-100 p-6 text-center text-zinc-700">Album not found.</section>
      </AlbumPageLayout>
    );
  }

  if (currentUser?.role !== "admin") {
    return (
      <AlbumPageLayout
        backLink={
          <Link href={`/albums/${album.id}`} className="text-base text-zinc-600 hover:underline">
            ← Back to album details
          </Link>
        }
      >
        <section className="border border-zinc-300 bg-zinc-100 p-6 text-center text-zinc-700">Only admin can edit albums.</section>
      </AlbumPageLayout>
    );
  }

  return (
    <AlbumPageLayout
      backLink={
        <Link href={`/albums/${album.id}`} className="text-base text-zinc-600 hover:underline">
          ← Back to album details
        </Link>
      }
    >
      <AlbumForm mode="edit" albumId={album.id} initialValues={album} />
    </AlbumPageLayout>
  );
}
