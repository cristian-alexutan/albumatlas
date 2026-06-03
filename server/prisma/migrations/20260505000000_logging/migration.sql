-- Migration: 20260505000000_logging
-- Adds the audit-log and malicious-behaviour observation tables.

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "ActionType" AS ENUM (
  'LOGIN',
  'LOGOUT',
  'REGISTER',
  'LOGIN_FAILED',
  'CREATE_ALBUM',
  'UPDATE_ALBUM',
  'DELETE_ALBUM',
  'CREATE_REVIEW',
  'DELETE_REVIEW',
  'RESOLVE_OBSERVATION',
  'VIEW_LOGS',
  'VIEW_OBSERVATIONS'
);

CREATE TYPE "ObservationSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

-- ── user_logs ─────────────────────────────────────────────────────────────────
-- Immutable audit trail.  userId is nullable so unauthenticated events
-- (e.g. failed login attempts) can still be recorded.
-- ON DELETE SET NULL keeps rows after user deletion (denormalised username field
-- provides a human-readable reference even when the FK is cleared).

CREATE TABLE "user_logs" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT,
  "username"  VARCHAR(100),
  "role"      "Role",
  "action"    "ActionType" NOT NULL,
  "details"   JSONB,
  "ipAddress" VARCHAR(45),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "user_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_logs"
  ADD CONSTRAINT "user_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Performance indexes
CREATE INDEX "user_logs_userId_idx"                ON "user_logs" ("userId");
CREATE INDEX "user_logs_action_idx"                ON "user_logs" ("action");
CREATE INDEX "user_logs_createdAt_idx"             ON "user_logs" ("createdAt");
CREATE INDEX "user_logs_userId_action_createdAt_idx" ON "user_logs" ("userId", "action", "createdAt");

-- ── observation_list ──────────────────────────────────────────────────────────
-- Suspicious users flagged by the behaviour-detection engine.
-- ON DELETE CASCADE: if the user is removed, their observation entries go too.

CREATE TABLE "observation_list" (
  "id"         TEXT                  NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"     TEXT                  NOT NULL,
  "username"   VARCHAR(100)          NOT NULL,
  "reason"     VARCHAR(200)          NOT NULL,
  "details"    JSONB,
  "severity"   "ObservationSeverity" NOT NULL DEFAULT 'LOW',
  "isResolved" BOOLEAN               NOT NULL DEFAULT false,
  "resolvedAt" TIMESTAMPTZ,
  "resolvedBy" VARCHAR(100),
  "createdAt"  TIMESTAMPTZ           NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ           NOT NULL DEFAULT now(),

  CONSTRAINT "observation_list_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "observation_list"
  ADD CONSTRAINT "observation_list_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Performance indexes
CREATE INDEX "observation_list_userId_idx"     ON "observation_list" ("userId");
CREATE INDEX "observation_list_isResolved_idx" ON "observation_list" ("isResolved");
CREATE INDEX "observation_list_severity_idx"   ON "observation_list" ("severity");
CREATE INDEX "observation_list_createdAt_idx"  ON "observation_list" ("createdAt");
