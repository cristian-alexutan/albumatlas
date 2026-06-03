import { GraphQLError } from "graphql";
import type { Session } from "express-session";
import { service } from "../service.js";
import { generator } from "../generator.js";
import { authService, type Permission } from "../auth/auth-service.js";
import {
  albumInputSchema,
  albumPatchSchema,
  trackInputSchema,
  trackPatchSchema,
} from "../validation.js";

function validationError(errors: Record<string, string[]>): GraphQLError {
  return new GraphQLError("Validation failed", {
    extensions: { code: "VALIDATION_ERROR", errors },
  });
}

type GraphqlContext = {
  session?: Session & Partial<{
    userId: string;
    role: "ADMIN" | "USER";
  }>;
};

function requirePermission(context: GraphqlContext, permission: Permission) {
  const role = context.session?.role;
  if (!context.session?.userId) {
    throw new GraphQLError("Login required.", { extensions: { code: "UNAUTHENTICATED" } });
  }
  if (!authService.hasPermission(role, permission)) {
    throw new GraphQLError("Permission denied.", { extensions: { code: "FORBIDDEN" } });
  }
}

export const resolvers = {
  Query: {
    albums(
      _: unknown,
      args: {
        page?: number;
        pageSize?: number;
        search?: string;
        genre?: string;
        sort?: "title" | "year" | "rating" | "artist";
        order?: "asc" | "desc";
      },
    ) {
      return service.listAlbums({
        page: args.page ?? 1,
        pageSize: args.pageSize ?? 20,
        search: args.search,
        genre: args.genre,
        sort: args.sort,
        order: args.order,
      });
    },

    album(_: unknown, { id }: { id: string }) {
      return service.getAlbum(id) ?? null;
    },

    tracks(_: unknown, { albumId }: { albumId: string }) {
      return service.listTracks(albumId) ?? null;
    },

    track(_: unknown, { id }: { id: string }) {
      return service.getTrack(id) ?? null;
    },

    statistics() {
      return service.statistics();
    },

    generatorStatus() {
      return { running: generator.running };
    },
  },

  Album: {
    tracks(parent: { id: string }) {
      return service.listTracks(parent.id) ?? [];
    },
  },

  Track: {
    album(parent: { albumId: string }) {
      return service.getAlbum(parent.albumId) ?? null;
    },
  },

  Mutation: {
    createAlbum(_: unknown, { input }: { input: unknown }, context: GraphqlContext) {
      requirePermission(context, "CREATE_ALBUM");
      const parsed = albumInputSchema.safeParse(input);
      if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
      return service.createAlbum(parsed.data);
    },

    updateAlbum(_: unknown, { id, patch }: { id: string; patch: unknown }, context: GraphqlContext) {
      requirePermission(context, "UPDATE_ALBUM");
      const parsed = albumPatchSchema.safeParse(patch);
      if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
      const album = service.updateAlbum(id, parsed.data);
      if (!album) throw new GraphQLError("Album not found", { extensions: { code: "NOT_FOUND" } });
      return album;
    },

    deleteAlbum(_: unknown, { id }: { id: string }, context: GraphqlContext) {
      requirePermission(context, "DELETE_ALBUM");
      return service.deleteAlbum(id);
    },

    createTrack(_: unknown, { albumId, input }: { albumId: string; input: unknown }, context: GraphqlContext) {
      requirePermission(context, "UPDATE_ALBUM");
      const parsed = trackInputSchema.safeParse(input);
      if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
      const track = service.createTrack(albumId, parsed.data);
      if (!track) throw new GraphQLError("Album not found", { extensions: { code: "NOT_FOUND" } });
      return track;
    },

    updateTrack(_: unknown, { id, patch }: { id: string; patch: unknown }, context: GraphqlContext) {
      requirePermission(context, "UPDATE_ALBUM");
      const parsed = trackPatchSchema.safeParse(patch);
      if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
      const track = service.updateTrack(id, parsed.data);
      if (!track) throw new GraphQLError("Track not found", { extensions: { code: "NOT_FOUND" } });
      return track;
    },

    deleteTrack(_: unknown, { id }: { id: string }, context: GraphqlContext) {
      requirePermission(context, "UPDATE_ALBUM");
      return service.deleteTrack(id);
    },

    startGenerator(_: unknown, _args: unknown, context: GraphqlContext) {
      requirePermission(context, "CREATE_ALBUM");
      generator.start();
      return { running: generator.running };
    },

    stopGenerator(_: unknown, _args: unknown, context: GraphqlContext) {
      requirePermission(context, "CREATE_ALBUM");
      generator.stop();
      return { running: generator.running };
    },
  },
};
