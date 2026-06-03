/**
 * observations.routes.ts
 *
 * Admin-only REST endpoints for the malicious-behaviour observation list.
 *
 * GET  /api/observations           – list entries (paginated, filterable)
 * GET  /api/observations/summary   – counts by severity / resolution state
 * PATCH /api/observations/:id/resolve – mark an entry as resolved
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { logAction } from "../logging/logger.service.js";

export const observationsRouter = Router();

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

// ── GET /api/observations ─────────────────────────────────────────────────────

observationsRouter.get("/", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const prisma = await getPrisma();
  if (!prisma) { res.status(503).json({ error: "Database not available." }); return; }

  const page       = Math.max(1, Number(req.query.page ?? 1));
  const pageSize   = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50)));
  const skip       = (page - 1) * pageSize;
  const onlyOpen   = req.query.resolved === "false" || req.query.resolved === undefined
    ? false
    : undefined; // undefined = show all

  const where: Record<string, unknown> = {};
  if (req.query.resolved === "false") where.isResolved = false;
  if (req.query.resolved === "true")  where.isResolved = true;
  if (req.query.severity)             where.severity   = String(req.query.severity);
  if (req.query.userId)               where.userId     = String(req.query.userId);
  if (req.query.username) {
    where.username = { contains: String(req.query.username), mode: "insensitive" };
  }

  void onlyOpen; // suppress unused-var warning

  const [total, entries] = await Promise.all([
    prisma.observationEntry.count({ where }),
    prisma.observationEntry.findMany({
      where,
      orderBy: [
        { isResolved: "asc"  },   // open entries first
        { severity:   "desc" },   // most severe first within open
        { createdAt:  "desc" },
      ],
      skip,
      take: pageSize,
    }),
  ]);

  // Log admin viewing the list
  void logAction({
    userId:   req.session.userId,
    username: req.session.username,
    role:     req.session.role as "ADMIN" | "USER",
    action:   "VIEW_OBSERVATIONS",
  });

  res.json({
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    entries: entries.map((e) => ({
      id:         e.id,
      userId:     e.userId,
      username:   e.username,
      reason:     e.reason,
      details:    e.details,
      severity:   e.severity,
      isResolved: e.isResolved,
      resolvedAt: e.resolvedAt,
      resolvedBy: e.resolvedBy,
      createdAt:  e.createdAt,
      updatedAt:  e.updatedAt,
    })),
  });
});

// ── GET /api/observations/summary ─────────────────────────────────────────────

observationsRouter.get("/summary", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const prisma = await getPrisma();
  if (!prisma) { res.status(503).json({ error: "Database not available." }); return; }

  const [openBySeverity, totalOpen, totalResolved, recentFlags] = await Promise.all([
    prisma.observationEntry.groupBy({
      by: ["severity"],
      where: { isResolved: false },
      _count: { severity: true },
    }),
    prisma.observationEntry.count({ where: { isResolved: false } }),
    prisma.observationEntry.count({ where: { isResolved: true } }),
    // Most recently flagged users (last 24h)
    prisma.observationEntry.findMany({
      where: {
        isResolved: false,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, username: true, reason: true, severity: true, createdAt: true },
    }),
  ]);

  res.json({
    totalOpen,
    totalResolved,
    openBySeverity: openBySeverity.map((g) => ({
      severity: g.severity,
      count:    g._count.severity,
    })),
    recentFlags,
  });
});

// ── PATCH /api/observations/:id/resolve ───────────────────────────────────────

observationsRouter.patch("/:id/resolve", async (req: Request<{ id: string }>, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const prisma = await getPrisma();
  if (!prisma) { res.status(503).json({ error: "Database not available." }); return; }

  const entry = await prisma.observationEntry.findUnique({
    where: { id: req.params.id },
  });

  if (!entry) {
    res.status(404).json({ error: "Observation entry not found." });
    return;
  }
  if (entry.isResolved) {
    res.status(409).json({ error: "Already resolved." });
    return;
  }

  const updated = await prisma.observationEntry.update({
    where: { id: req.params.id },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy: req.session.username ?? "admin",
    },
  });

  // Audit the resolve action
  void logAction({
    userId:   req.session.userId,
    username: req.session.username,
    role:     req.session.role as "ADMIN" | "USER",
    action:   "RESOLVE_OBSERVATION",
    details:  {
      observationId: entry.id,
      targetUserId:  entry.userId,
      targetUsername: entry.username,
      reason:        entry.reason,
      severity:      entry.severity,
    },
  });

  res.json({
    id:         updated.id,
    isResolved: updated.isResolved,
    resolvedAt: updated.resolvedAt,
    resolvedBy: updated.resolvedBy,
  });
});
