import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first"); // Railway has no IPv6 outbound – force IPv4 for all DNS lookups

import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import { createApp } from "./app.js";
import { attachWebSocketServer } from "./websocket.js";
import { attachChatWebSocketServer } from "./chat-ws.js";
import { repository } from "./repository.js";
import { loadSeed, seedRepository } from "./seed.js";
import { AlbumService, setService } from "./service.js";
import { hashPassword } from "./auth/auth-service.js";

const PORT = Number(process.env.PORT ?? 4000);
const INTERNAL_HTTP_PORT = process.env.INTERNAL_HTTP_PORT
  ? Number(process.env.INTERNAL_HTTP_PORT)
  : undefined;

// ── Permissions to seed (name → description) ─────────────────────────────────
const PERMISSIONS = [
  { name: "READ_ALBUM",    description: "View album details and tracks" },
  { name: "CREATE_ALBUM",  description: "Add new albums to the catalogue" },
  { name: "UPDATE_ALBUM",  description: "Edit existing albums and tracks" },
  { name: "DELETE_ALBUM",  description: "Remove albums from the catalogue" },
  { name: "CREATE_REVIEW", description: "Leave a review on any album" },
  { name: "DELETE_REVIEW", description: "Delete any review (admin only)" },
] as const;

// Which permissions each role holds
const ROLE_PERMISSIONS: Record<"ADMIN" | "USER", string[]> = {
  ADMIN: ["READ_ALBUM", "CREATE_ALBUM", "UPDATE_ALBUM", "DELETE_ALBUM", "CREATE_REVIEW", "DELETE_REVIEW"],
  USER:  ["READ_ALBUM", "CREATE_REVIEW"],
};

async function main() {
  // ── MongoDB (optional) ─────────────────────────────────────────────────────
  if (process.env.MONGODB_URL) {
    try {
      const { connectMongo } = await import("./mongodb.js");
      await connectMongo(process.env.MONGODB_URL);
    } catch (err) {
      console.warn("⚠️   MongoDB connection failed – chat history disabled:", err);
    }
  } else {
    console.log("💬  No MONGODB_URL – chat messages will not be persisted.");
  }

  if (process.env.DATABASE_URL) {
    // ── PostgreSQL path ──────────────────────────────────────────────────────
    const { PrismaAlbumRepository } = await import("./prisma-repository.js");
    const { prismaClient }          = await import("./prisma-client.js");

    const prismaRepo = new PrismaAlbumRepository(prismaClient);

    console.log("🗄️  Connecting to PostgreSQL…");
    await prismaRepo.loadFromDatabase();

    if (prismaRepo.allAlbums().length === 0) {
      console.log("📀  Database empty – seeding albums…");
      const { albums, tracks } = loadSeed();
      await prismaRepo.resetAndSync(albums, tracks);
      console.log(`✅  Seeded ${albums.length} albums, ${tracks.length} tracks.`);
    } else {
      console.log(`✅  Loaded ${prismaRepo.allAlbums().length} albums from DB.`);
    }

    await prismaRepo.refreshRatingsFromReviews();

    // ── Seed users + permissions (idempotent) ───────────────────────────────
    const adminExists = await prismaClient.user.findUnique({ where: { username: "admin" } });
    if (!adminExists) {
      console.log("👤  Seeding users and permissions…");

      // Use the same fixed TOTP secrets as auth-service.ts seed defaults so
      // developers can scan them once and reuse across restarts.
      const SEED_ADMIN_TOTP = process.env.SEED_ADMIN_TOTP ?? "JBSWY3DPEHPK3PXP";
      const SEED_USER_TOTP  = process.env.SEED_USER_TOTP  ?? "NBSWY3DPEHPK3PXP";

      await prismaClient.user.createMany({
        data: [
          {
            username:   "admin",
            email:      "admin@albumatlas.local",
            password:   hashPassword("admin"),
            role:       "ADMIN",
            totpSecret: SEED_ADMIN_TOTP,
          },
          {
            username:   "user",
            email:      "user@albumatlas.local",
            password:   hashPassword("user"),
            role:       "USER",
            totpSecret: SEED_USER_TOTP,
          },
        ],
        skipDuplicates: true,
      });

      for (const perm of PERMISSIONS) {
        await prismaClient.permission.upsert({
          where:  { name: perm.name },
          update: {},
          create: perm,
        });
      }

      for (const [role, permNames] of Object.entries(ROLE_PERMISSIONS) as [keyof typeof ROLE_PERMISSIONS, string[]][]) {
        for (const permName of permNames) {
          const permission = await prismaClient.permission.findUnique({ where: { name: permName } });
          if (!permission) continue;
          await prismaClient.rolePermission.upsert({
            where:  { role_permissionId: { role, permissionId: permission.id } },
            update: {},
            create: { role, permissionId: permission.id },
          });
        }
      }

      console.log("✅  Users and permissions seeded.");
    }

    setService(new AlbumService(prismaRepo));
  } else {
    // ── In-memory path ───────────────────────────────────────────────────────
    console.log("💾  No DATABASE_URL – using in-memory storage.");
    seedRepository(repository);
  }

  const app = await createApp();
  const httpsKeyPath = process.env.HTTPS_KEY_PATH;
  const httpsCertPath = process.env.HTTPS_CERT_PATH;
  const isHttps = Boolean(httpsKeyPath && httpsCertPath);
  const server = isHttps
    ? https.createServer({
      key: readFileSync(httpsKeyPath as string),
      cert: readFileSync(httpsCertPath as string),
    }, app)
    : http.createServer(app);

  attachWebSocketServer(server);
  attachChatWebSocketServer(server);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🎵  AlbumAtlas API  →  http://localhost:${PORT}`);
    console.log(`🔷  GraphQL         →  http://localhost:${PORT}/graphql`);
    console.log(`🔌  WebSocket       →  ws://localhost:${PORT}/ws`);
    console.log(`💬  Chat WebSocket  →  ws://localhost:${PORT}/chat`);
  });

  if (isHttps && INTERNAL_HTTP_PORT) {
    const internalServer = http.createServer(app);
    internalServer.listen(INTERNAL_HTTP_PORT, "0.0.0.0", () => {
      console.log(`Internal API proxy -> http://localhost:${INTERNAL_HTTP_PORT}`);
    });
  }
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
