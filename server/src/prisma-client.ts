import { PrismaClient } from "@prisma/client";

// Re-use a single PrismaClient instance across hot-reloads in development.
// In production a single instance is created once and reused for the
// lifetime of the process.
const globalForPrisma = globalThis as unknown as { _prisma?: PrismaClient };

export const prismaClient: PrismaClient =
  globalForPrisma._prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma._prisma = prismaClient;
}
