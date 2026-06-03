/**
 * logs.routes.ts
 *
 * Admin-only REST endpoints for querying the audit log.
 *
 * GET /api/logs
 *   Query params:
 *     page      – page number (default 1)
 *     pageSize  – entries per page (max 100, default 50)
 *     userId    – filter by user UUID
 *     username  – filter by username (partial, case-insensitive)
 *     action    – filter by ActionType enum value
 *     from      – ISO date string (inclusive lower bound on createdAt)
 *     to        – ISO date string (inclusive upper bound on createdAt)
 *
 * GET /api/logs/stats
 *   Returns aggregate counts per action type for the last 24 h.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { logAction } from "../logging/logger.service.js";

export const logsRouter = Router();

function requireAdmin(req: Request, res: Response): boolean {
  if (req.session.role !== "ADMIN") {
    res.status(403).json({ error: "Admin access required." });
    return false;
  }
  return true;
}

async function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  return import("../prisma-client.js").then((m) => m.prismaClient);
}

// ── GET /api/logs ─────────────────────────────────────────────────────────────

logsRouter.get("/", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const prisma = await getPrisma();
  if (!prisma) { res.status(503).json({ error: "Database not available." }); return; }

  const page     = Math.max(1, Number(req.query.page     ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50)));
  const skip     = (page - 1) * pageSize;

  // Build filter
  const where: Record<string, unknown> = {};

  if (req.query.userId)   where.userId   = String(req.query.userId);
  if (req.query.action)   where.action   = String(req.query.action);

  if (req.query.username) {
    where.username = { contains: String(req.query.username), mode: "insensitive" };
  }

  if (req.query.from || req.query.to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (req.query.from) range.gte = new Date(String(req.query.from));
    if (req.query.to)   range.lte = new Date(String(req.query.to));
    where.createdAt = range;
  }

  const [total, entries] = await Promise.all([
    prisma.userLog.count({ where }),
    prisma.userLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  // Log this admin action (fire-and-forget)
  void logAction({
    userId:   req.session.userId,
    username: req.session.username,
    role:     req.session.role as "ADMIN" | "USER",
    action:   "VIEW_LOGS",
    details:  { filters: req.query },
    ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
               req.socket?.remoteAddress,
  });

  res.json({
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    entries: entries.map((e) => ({
      id:        e.id,
      userId:    e.userId,
      username:  e.username,
      role:      e.role,
      action:    e.action,
      details:   e.details,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt,
    })),
  });
});

// ── GET /api/logs/stats ───────────────────────────────────────────────────────

logsRouter.get("/stats", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const prisma = await getPrisma();
  if (!prisma) { res.status(503).json({ error: "Database not available." }); return; }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Aggregate counts per action type in last 24h
  const counts = await prisma.userLog.groupBy({
    by: ["action"],
    where: { createdAt: { gte: since24h } },
    _count: { action: true },
    orderBy: { _count: { action: "desc" } },
  });

  // Recent unique active users (last 24h)
  const activeUsersResult = await prisma.userLog.findMany({
    where: { createdAt: { gte: since24h }, userId: { not: null } },
    select: { userId: true, username: true },
    distinct: ["userId"],
    take: 100,
  });

  // Failed login count last hour
  const failedLoginsLastHour = await prisma.userLog.count({
    where: {
      action: "LOGIN_FAILED",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });

  // Total log entries
  const totalEntries = await prisma.userLog.count();

  res.json({
    since: since24h,
    totalEntries,
    failedLoginsLastHour,
    activeUsersLast24h: activeUsersResult.length,
    actionCounts: counts.map((c) => ({
      action: c.action,
      count:  c._count.action,
    })),
  });
});
