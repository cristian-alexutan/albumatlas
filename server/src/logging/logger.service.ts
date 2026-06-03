/**
 * logger.service.ts
 *
 * Core audit-logging service.  Call `logAction()` anywhere in the server to
 * persist a structured log entry to PostgreSQL.  The function is fully
 * non-blocking — callers can fire-and-forget with `void logAction(...)`.
 *
 * After writing the entry it asynchronously kicks off the behaviour-detection
 * engine so the rest of the request pipeline is never delayed.
 */

import type { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Request } from "express";

// ── Public types ──────────────────────────────────────────────────────────────

export type ActionType =
  | "LOGIN"
  | "LOGOUT"
  | "REGISTER"
  | "LOGIN_FAILED"
  | "CREATE_ALBUM"
  | "UPDATE_ALBUM"
  | "DELETE_ALBUM"
  | "CREATE_REVIEW"
  | "DELETE_REVIEW"
  | "RESOLVE_OBSERVATION"
  | "VIEW_LOGS"
  | "VIEW_OBSERVATIONS";

export interface LogPayload {
  /** Authenticated user's ID (omit for anonymous events like failed logins). */
  userId?:   string;
  username?: string;
  role?:     Role;
  action:    ActionType;
  /** Arbitrary structured context (albumId, rating, targetUserId, …). */
  details?:  Record<string, unknown>;
  ipAddress?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  return import("../prisma-client.js").then((m) => m.prismaClient);
}

/**
 * Extract the real client IP from an Express request, honoring the
 * X-Forwarded-For header set by reverse proxies / Docker networks.
 */
export function extractIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? undefined;
}

// ── Core writer ───────────────────────────────────────────────────────────────

/**
 * Persist a log entry and (for authenticated users) asynchronously run the
 * malicious-behaviour detector.  Never throws — logging failures are swallowed
 * so they cannot disrupt normal request handling.
 */
export async function logAction(payload: LogPayload): Promise<void> {
  const prisma = await getPrisma();
  if (!prisma) return; // DB not configured (e.g. in-memory mode)

  try {
    await prisma.userLog.create({
      data: {
        userId:    payload.userId    ?? null,
        username:  payload.username  ?? null,
        role:      payload.role      ?? null,
        action:    payload.action,
        details:   payload.details !== undefined
                   ? (payload.details as Prisma.InputJsonValue)
                   : Prisma.DbNull,
        ipAddress: payload.ipAddress ?? null,
      },
    });

    // Kick off behaviour analysis without blocking the response
    if (payload.userId) {
      const { runDetection } = await import("./behavior-detector.js");
      runDetection({
        userId:    payload.userId,
        username:  payload.username ?? "",
        action:    payload.action,
        details:   payload.details,
        ipAddress: payload.ipAddress,
      }).catch((err: unknown) =>
        console.error("[BehaviorDetector] Unhandled error:", err),
      );
    }
  } catch (err) {
    // Logging MUST NOT crash the main request pipeline
    console.error("[Logger] Failed to write log entry:", err);
  }
}

/**
 * Convenience helper: build a LogPayload from an Express request + session data.
 *
 * Usage:
 *   void logAction(fromRequest(req, "CREATE_REVIEW", { albumId, rating }));
 */
export function fromRequest(
  req: Request,
  action: ActionType,
  details?: Record<string, unknown>,
): LogPayload {
  const s = req.session as { userId?: string; username?: string; role?: Role };
  return {
    userId:    s.userId,
    username:  s.username,
    role:      s.role,
    action,
    details,
    ipAddress: extractIp(req),
  };
}
