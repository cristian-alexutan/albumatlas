"use client";

import Link from "next/link";
import { AlbumPageLayout } from "@/app/albums/album-page-layout";
import { useAuth } from "@/app/components/auth-provider";
import { AlbumForm } from "@/app/components/album-form";

export default function AddAlbumPage() {
  const { currentUser } = useAuth();

  if (currentUser?.role !== "admin") {
    return (
      <AlbumPageLayout
        backLink={
          <Link href="/browse" className="text-base text-zinc-600 hover:underline">
            ← Back to album list
          </Link>
        }
      >
        <section className="border border-zinc-300 bg-zinc-100 p-6 text-center text-zinc-700">Only admin can add albums.</section>
      </AlbumPageLayout>
    );
  }

  return (
    <AlbumPageLayout
      backLink={
        <Link href="/browse" className="text-base text-zinc-600 hover:underline">
          ← Back to album list
        </Link>
      }
    >
      <AlbumForm mode="create" />
    </AlbumPageLayout>
  );
}
