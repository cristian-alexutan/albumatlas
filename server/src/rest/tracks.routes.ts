import { Router } from "express";
import type { Request, Response } from "express";
import { trackInputSchema, trackPatchSchema } from "../validation.js";
import { service } from "../service.js";
import { requirePermission } from "../auth/auth-middleware.js";

export const tracksRouter = Router({ mergeParams: true });

type TrackParams = { albumId: string; trackId: string };
type AlbumParam = { albumId: string };

// GET /api/albums/:albumId/tracks
tracksRouter.get("/", (req: Request<AlbumParam>, res: Response) => {
  const tracks = service.listTracks(req.params.albumId);
  if (!tracks) {
    res.status(404).json({ error: "Album not found" });
    return;
  }
  res.json(tracks);
});

// GET /api/albums/:albumId/tracks/:trackId
tracksRouter.get("/:trackId", (req: Request<TrackParams>, res: Response) => {
  const track = service.getTrack(req.params.trackId);
  if (!track || track.albumId !== req.params.albumId) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  res.json(track);
});

// POST /api/albums/:albumId/tracks
tracksRouter.post("/", requirePermission("UPDATE_ALBUM"), (req: Request<AlbumParam>, res: Response) => {
  const parsed = trackInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const track = service.createTrack(req.params.albumId, parsed.data);
  if (!track) {
    res.status(404).json({ error: "Album not found" });
    return;
  }
  res.status(201).json(track);
});

// PUT /api/albums/:albumId/tracks/:trackId
tracksRouter.put("/:trackId", requirePermission("UPDATE_ALBUM"), (req: Request<TrackParams>, res: Response) => {
  const existing = service.getTrack(req.params.trackId);
  if (!existing || existing.albumId !== req.params.albumId) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  const parsed = trackInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const track = service.updateTrack(req.params.trackId, parsed.data);
  res.json(track);
});

// PATCH /api/albums/:albumId/tracks/:trackId
tracksRouter.patch("/:trackId", requirePermission("UPDATE_ALBUM"), (req: Request<TrackParams>, res: Response) => {
  const existing = service.getTrack(req.params.trackId);
  if (!existing || existing.albumId !== req.params.albumId) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  const parsed = trackPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const track = service.updateTrack(req.params.trackId, parsed.data);
  res.json(track);
});

// DELETE /api/albums/:albumId/tracks/:trackId
tracksRouter.delete("/:trackId", requirePermission("UPDATE_ALBUM"), (req: Request<TrackParams>, res: Response) => {
  const existing = service.getTrack(req.params.trackId);
  if (!existing || existing.albumId !== req.params.albumId) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  service.deleteTrack(req.params.trackId);
  res.status(204).send();
});
