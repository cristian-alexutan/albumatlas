"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAlbums } from "@/app/components/albums-provider";
import { DeleteAlbumButtonView } from "@/app/components/delete-album-button-view";

type DeleteAlbumButtonProps = {
  albumId: string;
};

export function DeleteAlbumButton({ albumId }: DeleteAlbumButtonProps) {
  const router = useRouter();
  const { deleteAlbum } = useAlbums();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    const shouldDelete = window.confirm("Delete this album?");
    if (!shouldDelete) return;

    setIsDeleting(true);
    try {
      const isDeleted = await deleteAlbum(albumId);
      if (isDeleted) router.push("/browse");
    } finally {
      setIsDeleting(false);
    }
  }

  return <DeleteAlbumButtonView isDeleting={isDeleting} onDelete={handleDelete} />;
}
