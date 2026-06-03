type DeleteAlbumButtonViewProps = {
  isDeleting: boolean;
  onDelete: () => void;
};

export function DeleteAlbumButtonView({ isDeleting, onDelete }: DeleteAlbumButtonViewProps) {
  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={isDeleting}
      className="border border-zinc-300 bg-white px-6 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70 md:text-base"
    >
      {isDeleting ? "Deleting..." : "Delete Album"}
    </button>
  );
}

