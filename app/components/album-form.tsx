"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlbumFormView } from "@/app/components/album-form-view";
import { useAlbums } from "@/app/components/albums-provider";
import type { AlbumMutation } from "@/app/components/albums-provider";

type AlbumFormProps = {
  mode: "create" | "edit";
  albumId?: string;
  initialValues?: {
    title?: string;
    artist?: string;
    year?: number;
    genre?: string;
    coverUrl?: string;
    description?: string;
  };
};

type AlbumFormState = {
  title: string;
  artist: string;
  year: string;
  genre: string;
  coverUrl: string;
  description: string;
};

export function AlbumForm({ mode, albumId, initialValues }: AlbumFormProps) {
  const router = useRouter();
  const { createAlbum, updateAlbum } = useAlbums();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formState, setFormState] = useState<AlbumFormState>({
    title: initialValues?.title ?? "",
    artist: initialValues?.artist ?? "",
    year: initialValues?.year ? String(initialValues.year) : "",
    genre: initialValues?.genre ?? "",
    coverUrl: initialValues?.coverUrl ?? "",
    description: initialValues?.description ?? "",
  });

  const isEditMode = mode === "edit";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const yearNumber = Number(formState.year);
    if (!Number.isFinite(yearNumber) || yearNumber <= 0) {
      setError("Please enter a valid year.");
      return;
    }

    if (isEditMode && !albumId) {
      setError("Missing album id.");
      return;
    }

    const payload: AlbumMutation = {
      title: formState.title.trim(),
      artist: formState.artist.trim(),
      year: yearNumber,
      genre: formState.genre.trim(),
      coverUrl: formState.coverUrl.trim(),
      description: formState.description.trim(),
    };

    setIsSaving(true);

    try {
      if (isEditMode && albumId) {
        const updatedAlbum = await updateAlbum(albumId, payload);
        if (!updatedAlbum) {
          setError("Album not found.");
          return;
        }

        const nextUrl = `/albums/${updatedAlbum.id}`;
        router.push(nextUrl);
      } else {
        const createdAlbum = await createAlbum(payload);

        const nextUrl = `/albums/${createdAlbum.id}`;
        router.push(nextUrl);
      }
    } catch {
      setError("Could not save album. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AlbumFormView
      isEditMode={isEditMode}
      albumId={albumId}
      values={formState}
      isSaving={isSaving}
      notice={null}
      error={error}
      onSubmit={handleSubmit}
      onTitleChange={(value) => setFormState((prev) => ({ ...prev, title: value }))}
      onArtistChange={(value) => setFormState((prev) => ({ ...prev, artist: value }))}
      onYearChange={(value) => setFormState((prev) => ({ ...prev, year: value }))}
      onGenreChange={(value) => setFormState((prev) => ({ ...prev, genre: value }))}
      onCoverUrlChange={(value) => setFormState((prev) => ({ ...prev, coverUrl: value }))}
      onDescriptionChange={(value) => setFormState((prev) => ({ ...prev, description: value }))}
    />
  );
}
