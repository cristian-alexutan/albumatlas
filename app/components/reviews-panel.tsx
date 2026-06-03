"use client";

import { useEffect, useState } from "react";
import { fetchReviews, createReview, deleteReview, type Review } from "@/lib/api-client";
import { useAuth } from "@/app/components/auth-provider";
import { useAlbums } from "@/app/components/albums-provider";

type Props = { albumId: string };

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHover(star)}
          onMouseLeave={() => onChange && setHover(0)}
          className={`text-2xl leading-none ${
            star <= (hover || value) ? "text-yellow-500" : "text-zinc-300"
          } ${onChange ? "cursor-pointer" : "cursor-default"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function ReviewsPanel({ albumId }: Props) {
  const { currentUser } = useAuth();
  const { refreshAlbums } = useAlbums();
  const [reviews,     setReviews    ] = useState<Review[]>([]);
  const [isLoading,   setIsLoading  ] = useState(true);
  const [rating,      setRating     ] = useState(0);
  const [comment,     setComment    ] = useState("");
  const [submitting,  setSubmitting ] = useState(false);
  const [formError,   setFormError  ] = useState("");

  useEffect(() => {
    setIsLoading(true);
    fetchReviews(albumId)
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setIsLoading(false));
  }, [albumId]);

  const alreadyReviewed = reviews.some((r) => r.userId === currentUser?.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (rating === 0) { setFormError("Please select a star rating."); return; }
    if (!comment.trim()) { setFormError("Please write a comment."); return; }

    setSubmitting(true);
    try {
      const review = await createReview(albumId, { rating, comment });
      setReviews((prev) => [review, ...prev]);
      setRating(0);
      setComment("");
      await refreshAlbums();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(reviewId: string) {
    try {
      await deleteReview(albumId, reviewId);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      await refreshAlbums();
    } catch {
      // ignore
    }
  }

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  return (
    <div className="mt-7 border-t border-zinc-300 pt-6">
      <div className="flex items-baseline gap-4">
        <h2 className="text-xl font-medium text-zinc-900">Reviews</h2>
        {avgRating !== null && (
          <span className="text-sm text-zinc-500">
            {avgRating.toFixed(1)} / 5 avg · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Leave a review form ───────────────────────────────────────────── */}
      {currentUser && !alreadyReviewed && (
        <form onSubmit={handleSubmit} className="mt-5 border border-zinc-300 bg-white p-5">
          <p className="mb-3 text-base font-medium text-zinc-800">Leave a review</p>

          <div className="mb-3">
            <StarRating value={rating} onChange={setRating} />
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Share your thoughts about this album…"
            className="w-full border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />

          {formError && <p className="mt-1 text-xs text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-3 bg-zinc-700 px-5 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Review"}
          </button>
        </form>
      )}

      {!currentUser && (
        <p className="mt-4 text-sm text-zinc-500">
          <a href="/login" className="underline">Log in</a> to leave a review.
        </p>
      )}

      {alreadyReviewed && (
        <p className="mt-4 text-sm text-zinc-500">You have already reviewed this album.</p>
      )}

      {/* ── Review list ───────────────────────────────────────────────────── */}
      <div className="mt-5 space-y-4">
        {isLoading && <p className="text-sm text-zinc-400">Loading reviews…</p>}

        {!isLoading && reviews.length === 0 && (
          <p className="text-sm text-zinc-400">No reviews yet. Be the first!</p>
        )}

        {reviews.map((review) => {
          const canDelete =
            currentUser?.id === review.userId || currentUser?.role === "admin";
          return (
            <div key={review.id} className="border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-zinc-800">{review.username}</span>
                  <span className="ml-3 text-xs text-zinc-400">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(review.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="mt-1">
                <StarRating value={review.rating} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">{review.comment}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
