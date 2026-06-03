/**
 * behavior-detector.ts
 *
 * Asynchronous malicious-behaviour detection engine.
 *
 * `runDetection()` is called after every log entry.  It fetches the user's
 * recent activity from the database, applies a set of rules, and writes to
 * `observation_list` when a rule fires.
 *
 * ── Detection rules ──────────────────────────────────────────────────────────
 *
 *  1. NEGATIVE_REVIEW_SPAM   – posting many low-rating reviews quickly
 *  2. RAPID_REVIEW_BURST     – posting any reviews too fast (gaming ratings)
 *  3. REVIEW_DELETE_ABUSE    – deleting many reviews in a short window
 *  4. MASS_CONTENT_DELETION  – admin deleting many albums rapidly
 *  5. LOGIN_BRUTE_FORCE      – many failed login attempts from same user/IP
 *  6. EXCESSIVE_ACTIVITY     – abnormally high action volume (scraping / flood)
 *
 * Rules are additive: a user can be on the observation list for multiple
 * reasons simultaneously.  Each rule only escalates severity, never decreases
 * it on an existing open entry.
 */

import { Prisma } from "@prisma/client";
import type { ActionType } from "./logger.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DetectionContext {
  userId:    string;
  username:  string;
  action:    ActionType;
  details?:  Record<string, unknown>;
  ipAddress?: string;
}

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface RuleResult {
  reason:   string;
  severity: Severity;
  details:  Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  return import("../prisma-client.js").then((m) => m.prismaClient);
}

/** Return a Date that is `minutes` ago from now. */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const SEVERITY_ORDER: Record<Severity, number> = {
  LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3,
};

function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

// ── Rule implementations ──────────────────────────────────────────────────────

/**
 * Rule 1 – NEGATIVE_REVIEW_SPAM
 * Triggers when a user posts multiple low-rating reviews in a short window.
 * This catches deliberate reputation-damage ("review bombing") campaigns.
 *
 *  LOW    : ≥ 3 reviews with rating ≤ 2 in the last 60 min
 *  MEDIUM : ≥ 5 reviews with rating ≤ 2 in the last 60 min
 *  HIGH   : ≥ 3 reviews with rating ≤ 2 in the last 10 min
 */
function ruleNegativeReviewSpam(
  logs: { action: string; details: unknown; createdAt: Date }[],
): RuleResult | null {
  const isNeg = (l: { action: string; details: unknown }) => {
    if (l.action !== "CREATE_REVIEW") return false;
    const d = l.details as Record<string, unknown> | null;
    const rating = typeof d?.rating === "number" ? d.rating : null;
    return rating !== null && rating <= 2;
  };

  const in10min  = logs.filter((l) => isNeg(l) && l.createdAt >= ago(10)).length;
  const in60min  = logs.filter((l) => isNeg(l) && l.createdAt >= ago(60)).length;

  if (in10min >= 3) {
    return {
      reason: "NEGATIVE_REVIEW_SPAM",
      severity: "HIGH",
      details: { rule: "≥3 negative reviews (rating ≤ 2) in 10 min", in10min, in60min },
    };
  }
  if (in60min >= 5) {
    return {
      reason: "NEGATIVE_REVIEW_SPAM",
      severity: "MEDIUM",
      details: { rule: "≥5 negative reviews (rating ≤ 2) in 60 min", in10min, in60min },
    };
  }
  if (in60min >= 3) {
    return {
      reason: "NEGATIVE_REVIEW_SPAM",
      severity: "LOW",
      details: { rule: "≥3 negative reviews (rating ≤ 2) in 60 min", in10min, in60min },
    };
  }
  return null;
}

/**
 * Rule 2 – RAPID_REVIEW_BURST
 * Triggers when any reviews (regardless of rating) are posted too fast.
 * Indicates an attempt to flood albums with artificial ratings.
 *
 *  LOW    : ≥ 5 reviews in 60 min
 *  MEDIUM : ≥ 8 reviews in 60 min
 *  HIGH   : ≥ 5 reviews in 15 min
 */
function ruleRapidReviewBurst(
  logs: { action: string; createdAt: Date }[],
): RuleResult | null {
  const isCreate = (l: { action: string }) => l.action === "CREATE_REVIEW";

  const in15min = logs.filter((l) => isCreate(l) && l.createdAt >= ago(15)).length;
  const in60min = logs.filter((l) => isCreate(l) && l.createdAt >= ago(60)).length;

  if (in15min >= 5) {
    return {
      reason: "RAPID_REVIEW_BURST",
      severity: "HIGH",
      details: { rule: "≥5 reviews in 15 min", in15min, in60min },
    };
  }
  if (in60min >= 8) {
    return {
      reason: "RAPID_REVIEW_BURST",
      severity: "MEDIUM",
      details: { rule: "≥8 reviews in 60 min", in15min, in60min },
    };
  }
  if (in60min >= 5) {
    return {
      reason: "RAPID_REVIEW_BURST",
      severity: "LOW",
      details: { rule: "≥5 reviews in 60 min", in15min, in60min },
    };
  }
  return null;
}

/**
 * Rule 3 – REVIEW_DELETE_ABUSE
 * Detects users who mass-delete reviews (e.g. a rogue admin wiping reviews).
 *
 *  MEDIUM : ≥ 5 review deletions in 10 min
 *  HIGH   : ≥ 10 review deletions in 10 min
 */
function ruleReviewDeleteAbuse(
  logs: { action: string; createdAt: Date }[],
): RuleResult | null {
  const isDel = (l: { action: string }) => l.action === "DELETE_REVIEW";
  const in10min = logs.filter((l) => isDel(l) && l.createdAt >= ago(10)).length;

  if (in10min >= 10) {
    return {
      reason: "REVIEW_DELETE_ABUSE",
      severity: "HIGH",
      details: { rule: "≥10 review deletions in 10 min", in10min },
    };
  }
  if (in10min >= 5) {
    return {
      reason: "REVIEW_DELETE_ABUSE",
      severity: "MEDIUM",
      details: { rule: "≥5 review deletions in 10 min", in10min },
    };
  }
  return null;
}

/**
 * Rule 4 – MASS_CONTENT_DELETION
 * Catches an admin (or compromised account) bulk-deleting albums.
 *
 *  MEDIUM : ≥ 3 album deletions in 5 min
 *  HIGH   : ≥ 6 album deletions in 5 min
 *  CRITICAL: ≥ 10 album deletions in 5 min
 */
function ruleMassContentDeletion(
  logs: { action: string; createdAt: Date }[],
): RuleResult | null {
  const isDel = (l: { action: string }) => l.action === "DELETE_ALBUM";
  const in5min = logs.filter((l) => isDel(l) && l.createdAt >= ago(5)).length;

  if (in5min >= 10) {
    return {
      reason: "MASS_CONTENT_DELETION",
      severity: "CRITICAL",
      details: { rule: "≥10 album deletions in 5 min", in5min },
    };
  }
  if (in5min >= 6) {
    return {
      reason: "MASS_CONTENT_DELETION",
      severity: "HIGH",
      details: { rule: "≥6 album deletions in 5 min", in5min },
    };
  }
  if (in5min >= 3) {
    return {
      reason: "MASS_CONTENT_DELETION",
      severity: "MEDIUM",
      details: { rule: "≥3 album deletions in 5 min", in5min },
    };
  }
  return null;
}

/**
 * Rule 5 – LOGIN_BRUTE_FORCE
 * Detects repeated failed login attempts for the same user account.
 * (IP-based detection uses a separate query since userId may be null.)
 *
 *  MEDIUM : ≥ 5 LOGIN_FAILED in 10 min
 *  HIGH   : ≥ 10 LOGIN_FAILED in 10 min
 */
function ruleLoginBruteForce(
  logs: { action: string; createdAt: Date }[],
): RuleResult | null {
  const isFailed = (l: { action: string }) => l.action === "LOGIN_FAILED";
  const in10min  = logs.filter((l) => isFailed(l) && l.createdAt >= ago(10)).length;

  if (in10min >= 10) {
    return {
      reason: "LOGIN_BRUTE_FORCE",
      severity: "HIGH",
      details: { rule: "≥10 failed login attempts in 10 min", in10min },
    };
  }
  if (in10min >= 5) {
    return {
      reason: "LOGIN_BRUTE_FORCE",
      severity: "MEDIUM",
      details: { rule: "≥5 failed login attempts in 10 min", in10min },
    };
  }
  return null;
}

/**
 * Rule 6 – EXCESSIVE_ACTIVITY
 * Catches abnormally high overall action volume — indicative of automation,
 * scraping, or a denial-of-service attempt.
 *
 *  LOW    : ≥ 60 actions in 5 min
 *  MEDIUM : ≥ 120 actions in 5 min
 *  HIGH   : ≥ 200 actions in 5 min
 */
function ruleExcessiveActivity(
  logs: { createdAt: Date }[],
): RuleResult | null {
  const in5min = logs.filter((l) => l.createdAt >= ago(5)).length;

  if (in5min >= 200) {
    return {
      reason: "EXCESSIVE_ACTIVITY",
      severity: "HIGH",
      details: { rule: "≥200 actions in 5 min", in5min },
    };
  }
  if (in5min >= 120) {
    return {
      reason: "EXCESSIVE_ACTIVITY",
      severity: "MEDIUM",
      details: { rule: "≥120 actions in 5 min", in5min },
    };
  }
  if (in5min >= 60) {
    return {
      reason: "EXCESSIVE_ACTIVITY",
      severity: "LOW",
      details: { rule: "≥60 actions in 5 min", in5min },
    };
  }
  return null;
}

// ── Flag writer ───────────────────────────────────────────────────────────────

/**
 * Upsert an observation entry for a given user + reason.
 *
 * If an open (unresolved) entry already exists for this (userId, reason) pair:
 *   – Escalate the severity if the new result is worse.
 *   – Always update the evidence details to the latest values.
 *
 * If no open entry exists (or the last one was resolved), create a new one.
 */
async function flagUser(
  userId: string,
  username: string,
  result: RuleResult,
): Promise<void> {
  const prisma = await getPrisma();
  if (!prisma) return;

  const existing = await prisma.observationEntry.findFirst({
    where: { userId, reason: result.reason, isResolved: false },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const newSeverity = maxSeverity(existing.severity, result.severity);
    await prisma.observationEntry.update({
      where: { id: existing.id },
      data: {
        severity:  newSeverity,
        details:   result.details as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
    console.log(
      `[BehaviorDetector] ⚠  Updated observation for ${username}: ${result.reason} → ${newSeverity}`,
    );
  } else {
    await prisma.observationEntry.create({
      data: {
        userId,
        username,
        reason:   result.reason,
        severity: result.severity,
        details:  result.details as Prisma.InputJsonValue,
      },
    });
    console.log(
      `[BehaviorDetector] 🚨 Flagged ${username} (${userId}): ${result.reason} [${result.severity}]`,
    );
  }
}

// ── Engine entry point ────────────────────────────────────────────────────────

/**
 * Run all applicable detection rules for the given user and action.
 * This is called asynchronously from logger.service.ts.
 */
export async function runDetection(ctx: DetectionContext): Promise<void> {
  const prisma = await getPrisma();
  if (!prisma) return;

  // Fetch enough recent history to cover all rule windows (max window = 60 min).
  // Cap at 500 rows to protect against pathological cases.
  const recentLogs = await prisma.userLog.findMany({
    where: {
      userId: ctx.userId,
      createdAt: { gte: ago(60) },
    },
    select: { action: true, details: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Determine which rules are relevant to the current action
  // (avoid running every rule on every action – only test rules that could
  //  newly fire based on what just happened).
  const triggered: (RuleResult | null)[] = [];

  if (ctx.action === "CREATE_REVIEW") {
    triggered.push(
      ruleNegativeReviewSpam(recentLogs),
      ruleRapidReviewBurst(recentLogs),
    );
  }

  if (ctx.action === "DELETE_REVIEW") {
    triggered.push(ruleReviewDeleteAbuse(recentLogs));
  }

  if (ctx.action === "DELETE_ALBUM") {
    triggered.push(ruleMassContentDeletion(recentLogs));
  }

  if (ctx.action === "LOGIN_FAILED") {
    triggered.push(ruleLoginBruteForce(recentLogs));
  }

  // Excessive-activity rule runs on every action
  triggered.push(ruleExcessiveActivity(recentLogs));

  // Write observations for any rules that fired
  for (const result of triggered) {
    if (result) {
      await flagUser(ctx.userId, ctx.username, result);
    }
  }
}
