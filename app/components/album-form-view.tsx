import type { FormEvent } from "react";
import Link from "next/link";

type AlbumFormValues = {
  title: string;
  artist: string;
  year: string;
  genre: string;
  coverUrl: string;
  description: string;
};

type AlbumFormViewProps = {
  isEditMode: boolean;
  albumId?: string;
  values: AlbumFormValues;
  isSaving: boolean;
  notice?: string | null;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  onArtistChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onGenreChange: (value: string) => void;
  onCoverUrlChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
};

export function AlbumFormView({
  isEditMode,
  albumId,
  values,
  isSaving,
  notice,
  error,
  onSubmit,
  onTitleChange,
  onArtistChange,
  onYearChange,
  onGenreChange,
  onCoverUrlChange,
  onDescriptionChange,
}: AlbumFormViewProps) {
  return (
    <form onSubmit={onSubmit} className="border border-zinc-300 bg-zinc-100 p-8">
      <h1 className="text-2xl font-semibold text-zinc-900">{isEditMode ? "Edit Album" : "Add New Album"}</h1>

      <div className="mt-10 space-y-7">
        <label className="block">
          <span className="mb-2 block text-base font-medium text-zinc-800">Album Name</span>
          <input
            required
            value={values.title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="h-11 w-full border border-zinc-300 bg-white px-4 text-sm text-zinc-800 outline-none focus:border-zinc-500"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-base font-medium text-zinc-800">Artist</span>
          <input
            required
            value={values.artist}
            onChange={(event) => onArtistChange(event.target.value)}
            className="h-11 w-full border border-zinc-300 bg-white px-4 text-sm text-zinc-800 outline-none focus:border-zinc-500"
          />
        </label>

        <div className="grid gap-6 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-base font-medium text-zinc-800">Year</span>
            <input
              required
              type="number"
              min={1900}
              max={2099}
              value={values.year}
              onChange={(event) => onYearChange(event.target.value)}
              className="h-11 w-full border border-zinc-300 bg-white px-4 text-sm text-zinc-800 outline-none focus:border-zinc-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-base font-medium text-zinc-800">Genre</span>
            <input
              required
              value={values.genre}
              onChange={(event) => onGenreChange(event.target.value)}
              className="h-11 w-full border border-zinc-300 bg-white px-4 text-sm text-zinc-800 outline-none focus:border-zinc-500"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-base font-medium text-zinc-800">Cover Image URL</span>
          <input
            required
            type="url"
            placeholder="https://example.com/cover.jpg"
            value={values.coverUrl}
            onChange={(event) => onCoverUrlChange(event.target.value)}
            className="h-11 w-full border border-zinc-300 bg-white px-4 text-sm text-zinc-800 outline-none focus:border-zinc-500"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-base font-medium text-zinc-800">Description</span>
          <textarea
            required
            rows={6}
            value={values.description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className="w-full border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-800 outline-none focus:border-zinc-500"
          />
        </label>
      </div>

      {notice ? <p className="mt-4 text-sm text-zinc-700">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-8 flex items-center gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="min-w-32 bg-zinc-700 px-6 py-2.5 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 md:text-base"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>

        <Link
          href={isEditMode && albumId ? `/albums/${albumId}` : "/browse"}
          className="border border-zinc-300 bg-white px-6 py-2.5 text-sm text-zinc-700 md:text-base"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

