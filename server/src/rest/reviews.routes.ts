import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { service } from "../service.js";
import { logAction, fromRequest } from "../logging/logger.service.js";
import { requireAuth, requirePermission } from "../auth/auth-middleware.js";

export const reviewsRouter = Router({ mergeParams: true });

type AlbumParam  = { albumId: string };
type ReviewParam = { albumId: string; reviewId: string };

const reviewInputSchema = z.object({
  rating:  z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
});

function getSession(req: Request) {
  return req.session;
}

async function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  return import("../prisma-client.js").then((m) => m.prismaClient);
}

async function updateAlbumRating(prisma: Awaited<ReturnType<typeof getPrisma>>, albumId: string) {
  if (!prisma) return;
  const avg = await prisma.review.aggregate({
    where: { albumId },
    _avg: { rating: true },
  });
  const rating = Number((avg._avg.rating ?? 0).toFixed(2));
  await prisma.album.update({ where: { id: albumId }, data: { rating } });
  service.updateAlbum(albumId, { rating });
}

// ── GET /api/albums/:albumId/reviews ─────────────────────────────────────────
reviewsRouter.get("/", async (req: Request<AlbumParam>, res: Response) => {
  const prisma = await getPrisma();
  if (!prisma) { res.status(503).json({ error: "Database not available." }); return; }

  const reviews = await prisma.review.findMany({
    where:   { albumId: req.params.albumId },
    include: { user: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
  });

  res.json(reviews.map((r) => ({
    id:        r.id,
    albumId:   r.albumId,
    userId:    r.userId,
    username:  r.user.username,
    rating:    r.rating,
    comment:   r.comment,
    createdAt: r.createdAt,
  })));
});

// ── POST /api/albums/:albumId/reviews ─────────────────────────────────────────
reviewsRouter.post("/", requirePermission("CREATE_REVIEW"), async (req: Request<AlbumParam>, res: Response) => {
  const session = getSession(req);
  if (!session.userId) { res.status(401).json({ error: "Login required." }); return; }

  const parsed = reviewInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const prisma = await getPrisma();
  if (!prisma) { res.status(503).json({ error: "Database not available." }); return; }

  // Check album exists
  const album = await prisma.album.findUnique({ where: { id: req.params.albumId } });
  if (!album) { res.status(404).json({ error: "Album not found." }); return; }

  try {
    const review = await prisma.review.create({
      data: {
        albumId: req.params.albumId,
        userId:  session.userId,
        rating:  parsed.data.rating,
        comment: parsed.data.comment,
      },
      include: { user: { select: { username: true } } },
    });

    await updateAlbumRating(prisma, req.params.albumId);

    void logAction(fromRequest(req, "CREATE_REVIEW", {
      albumId:    req.params.albumId,
      albumTitle: album.title,
      reviewId:   review.id,
      rating:     parsed.data.rating,
    }));

    res.status(201).json({
      id:        review.id,
      albumId:   review.albumId,
      userId:    review.userId,
      username:  review.user.username,
      rating:    review.rating,
      comment:   review.comment,
      createdAt: review.createdAt,
    });
  } catch {
    // Unique constraint: user already reviewed this album
    res.status(409).json({ error: "You have already reviewed this album." });
  }
});

// ── DELETE /api/albums/:albumId/reviews/:reviewId ─────────────────────────────
reviewsRouter.delete("/:reviewId", requireAuth, async (req: Request<ReviewParam>, res: Response) => {
  const session = getSession(req);
  if (!session.userId) { res.status(401).json({ error: "Login required." }); return; }

  const prisma = await getPrisma();
  if (!prisma) { res.status(503).json({ error: "Database not available." }); return; }

  const review = await prisma.review.findUnique({ where: { id: req.params.reviewId } });
  if (!review || review.albumId !== req.params.albumId) {
    res.status(404).json({ error: "Review not found." });
    return;
  }

  // Only the author or an admin may delete a review
  if (review.userId !== session.userId && session.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden." });
    return;
  }

  await prisma.review.delete({ where: { id: req.params.reviewId } });
  await updateAlbumRating(prisma, req.params.albumId);

  void logAction(fromRequest(req, "DELETE_REVIEW", {
    reviewId:       review.id,
    albumId:        review.albumId,
    targetUserId:   review.userId,
    rating:         review.rating,
    deletedByAdmin: session.role === "ADMIN" && review.userId !== session.userId,
  }));

  res.status(204).send();
});
