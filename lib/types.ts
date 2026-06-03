/**
 * Re-exports shared types from api-client.
 * Kept for backward compatibility with existing imports.
 */
export type {
  Album,
  Track,
  AlbumInput as AlbumMutation,
} from "./api-client";

export type UserRole = "user" | "admin";

export type AuthUser = {
  id:       string;
  username: string;
  role:     UserRole;
};
