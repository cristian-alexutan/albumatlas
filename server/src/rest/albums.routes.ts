import { Router } from "express";
import type { Request, Response } from "express";
import { albumInputSchema, albumPatchSchema, pageQuerySchema } from "../validation.js";
import { service } from "../service.js";
import { logAction, fromRequest } from "../logging/logger.service.js";
import { requirePermission } from "../auth/auth-middleware.js";

export const albumsRouter = Router();

type IdParam = { id: string };

// GET /api/albums?page=1&pageSize=20&search=&genre=&sort=&order=
albumsRouter.get("/", (req: Request, res: Response) => {
  const parsed = pageQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const page = service.listAlbums(parsed.data);
  res.json(page);
});

// GET /api/albums/:id
albumsRouter.get("/:id", (req: Request<IdParam>, res: Response) => {
  const album = service.getAlbum(req.params.id);
  if (!album) {
    res.status(404).json({ error: "Album not found" });
    return;
  }
  res.json(album);
});

// POST /api/albums
albumsRouter.post("/", requirePermission("CREATE_ALBUM"), (req: Request, res: Response) => {
  const parsed = albumInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const album = service.createAlbum({ ...parsed.data, rating: 0 });

  void logAction(fromRequest(req, "CREATE_ALBUM", {
    albumId: album.id,
    title:   album.title,
    artist:  album.artist,
  }));

  res.status(201).json(album);
});

// PUT /api/albums/:id  (full replace)
albumsRouter.put("/:id", requirePermission("UPDATE_ALBUM"), (req: Request<IdParam>, res: Response) => {
  const parsed = albumInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { rating: _ignoredRating, ...rest } = parsed.data;
  const album = service.updateAlbum(req.params.id, rest);
  if (!album) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  void logAction(fromRequest(req, "UPDATE_ALBUM", {
    albumId: req.params.id,
    title:   album.title,
  }));

  res.json(album);
});

// PATCH /api/albums/:id  (partial update)
albumsRouter.patch("/:id", requirePermission("UPDATE_ALBUM"), (req: Request<IdParam>, res: Response) => {
  const parsed = albumPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { rating: _ignoredRating, ...rest } = parsed.data;
  const album = service.updateAlbum(req.params.id, rest);
  if (!album) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  void logAction(fromRequest(req, "UPDATE_ALBUM", {
    albumId: req.params.id,
    fields:  Object.keys(rest),
  }));

  res.json(album);
});

// DELETE /api/albums/:id
albumsRouter.delete("/:id", requirePermission("DELETE_ALBUM"), (req: Request<IdParam>, res: Response) => {
  const album = service.getAlbum(req.params.id);
  const deleted = service.deleteAlbum(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  void logAction(fromRequest(req, "DELETE_ALBUM", {
    albumId: req.params.id,
    title:   album?.title,
    artist:  album?.artist,
  }));

  res.status(204).send();
});
