import { z } from "zod";

const currentYear = new Date().getFullYear();

export const albumInputSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200),
  artist: z.string().trim().min(1, "artist is required").max(200),
  year: z
    .number({ invalid_type_error: "year must be a number" })
    .int("year must be an integer")
    .min(1900, "year must be >= 1900")
    .max(currentYear + 1, `year must be <= ${currentYear + 1}`),
  genre: z.string().trim().min(1, "genre is required").max(80),
  coverUrl: z
    .string()
    .trim()
    .url("coverUrl must be a valid URL")
    .max(2048),
  description: z.string().trim().max(2000).default(""),
  rating: z
    .number({ invalid_type_error: "rating must be a number" })
    .min(0)
    .max(5)
    .default(0),
  featured: z.boolean().default(false),
});

export const albumPatchSchema = albumInputSchema.partial();

export const trackInputSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200),
  position: z
    .number({ invalid_type_error: "position must be a number" })
    .int()
    .min(1, "position must be >= 1")
    .max(500),
  durationSec: z
    .number({ invalid_type_error: "durationSec must be a number" })
    .int()
    .min(1, "durationSec must be >= 1")
    .max(60 * 60 * 3, "durationSec is unrealistically large"),
});

export const trackPatchSchema = trackInputSchema.partial();

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(80).optional(),
  sort: z.enum(["title", "year", "rating", "artist"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export type AlbumInputDto = z.infer<typeof albumInputSchema>;
export type AlbumPatchDto = z.infer<typeof albumPatchSchema>;
export type TrackInputDto = z.infer<typeof trackInputSchema>;
export type TrackPatchDto = z.infer<typeof trackPatchSchema>;
export type PageQueryDto = z.infer<typeof pageQuerySchema>;
