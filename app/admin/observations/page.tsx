"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth-provider";
import { API_BASE } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ObservationEntry {
  id:         string;
  userId:     string;
  username:   string;
  reason:     string;
  details:    Record<string, unknown> | null;
  severity:   "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt:  string;
  updatedAt:  string;
}

interface Summary {
  totalOpen:      number;
  totalResolved:  number;
  openBySeverity: { severity: string; count: number }[];
  recentFlags:    { id: string; username: string; reason: string; severity: string; createdAt: string }[];
}

interface ObsResponse {
  page:       number;
  pageSize:   number;
  total:      number;
  totalPages: number;
  entries:    ObservationEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  LOW:      "bg-yellow-100 text-yellow-800 border-yellow-300",
  MEDIUM:   "bg-orange-100 text-orange-800 border-orange-300",
  HIGH:     "bg-red-100    text-red-800    border-red-300",
  CRITICAL: "bg-red-200    text-red-900    border-red-500",
};

const REASON_LABELS: Record<string, string> = {
  NEGATIVE_REVIEW_SPAM:  "Negative Review Spam",
  RAPID_REVIEW_BURST:    "Rapid Review Burst",
  REVIEW_DELETE_ABUSE:   "Review Delete Abuse",
  MASS_CONTENT_DELETION: "Mass Content Deletion",
  LOGIN_BRUTE_FORCE:     "Login Brute Force",
  EXCESSIVE_ACTIVITY:    "Excessive Activity",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function EvidenceCard({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return null;
  return (
    <div className="mt-2 rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
      {Object.entries(details).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="font-medium text-zinc-500 w-24 shrink-0">{k}</span>
          <span>{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminObservationsPage() {
  const { currentUser, isLoading } = useAuth();
  const router = useRouter();

  const [entries,    setEntries   ] = useState<ObservationEntry[]>([]);
  const [summary,    setSummary   ] = useState<Summary | null>(null);
  const [total,      setTotal     ] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage      ] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  const [resolving,  setResolving ] = useState<string | null>(null);

  // Filters
  const [filterResolved, setFilterResolved] = useState<"open" | "resolved" | "all">("open");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterUsername, setFilterUsername] = useState("");

  const PAGE_SIZE = 30;

  // Guard: admins only
  useEffect(() => {
    if (!isLoading && (!currentUser || currentUser.role !== "admin")) {
      router.replace("/");
    }
  }, [currentUser, isLoading, router]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/observations/summary`, { credentials: "include" });
      if (res.ok) setSummary(await res.json() as Summary);
    } catch { /* ignore */ }
  }, []);

  const fetchEntries = useCallback(async (p: number) => {
    setIsFetching(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (filterResolved === "open")     params.set("resolved", "false");
      if (filterResolved === "resolved") params.set("resolved", "true");
      if (filterSeverity) params.set("severity", filterSeverity);
      if (filterUsername) params.set("username", filterUsername);

      const res = await fetch(`${API_BASE}/api/observations?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as ObsResponse;
        setEntries(data.entries);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(data.page);
      }
    } finally {
      setIsFetching(false);
    }
  }, [filterResolved, filterSeverity, filterUsername]);

  useEffect(() => {
    if (currentUser?.role === "admin") {
      void fetchSummary();
      void fetchEntries(1);
    }
  }, [currentUser, fetchSummary, fetchEntries]);

  async function resolve(id: string) {
    setResolving(id);
    try {
      const res = await fetch(`${API_BASE}/api/observations/${id}/resolve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        // Refresh both panels
        await fetchEntries(page);
        await fetchSummary();
      }
    } finally {
      setResolving(null);
    }
  }

  if (isLoading || !currentUser || currentUser.role !== "admin") {
    return <div className="flex h-screen items-center justify-center text-zinc-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-800">Observation List</h1>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border border-red-200 bg-red-50 p-4">
            <p className="text-xs text-red-500">Open flags</p>
            <p className="mt-1 text-2xl font-bold text-red-700">{summary.totalOpen}</p>
          </div>
          <div className="rounded border border-green-200 bg-green-50 p-4">
            <p className="text-xs text-green-600">Resolved</p>
            <p className="mt-1 text-2xl font-bold text-green-800">{summary.totalResolved}</p>
          </div>
          {["CRITICAL","HIGH"].map((sev) => {
            const count = summary.openBySeverity.find((s) => s.severity === sev)?.count ?? 0;
            return (
              <div key={sev} className={`rounded border p-4 ${SEVERITY_STYLES[sev]}`}>
                <p className="text-xs">{sev}</p>
                <p className="mt-1 text-2xl font-bold">{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent flags */}
      {summary && summary.recentFlags.length > 0 && (
        <div className="mb-6 rounded border border-orange-200 bg-orange-50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600">
            Recently flagged (last 24 h)
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.recentFlags.map((f) => (
              <span
                key={f.id}
                className={`rounded border px-2 py-1 text-xs font-medium ${SEVERITY_STYLES[f.severity]}`}
              >
                {f.username} — {REASON_LABELS[f.reason] ?? f.reason}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={filterResolved}
          onChange={(e) => setFilterResolved(e.target.value as "open" | "resolved" | "all")}
          className="border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="open">Open only</option>
          <option value="resolved">Resolved only</option>
          <option value="all">All</option>
        </select>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">All severities</option>
          {["LOW","MEDIUM","HIGH","CRITICAL"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <input
          value={filterUsername}
          onChange={(e) => setFilterUsername(e.target.value)}
          placeholder="Username…"
          className="border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />

        <button
          onClick={() => fetchEntries(1)}
          disabled={isFetching}
          className="bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {isFetching ? "Loading…" : "Apply"}
        </button>
      </div>

      {/* ── Observation cards ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        {entries.length === 0 && (
          <div className="rounded border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400">
            {isFetching ? "Loading…" : "No observations match the current filters."}
          </div>
        )}

        {entries.map((e) => (
          <div
            key={e.id}
            className={`rounded border-l-4 bg-white shadow-sm ${
              e.isResolved ? "border-zinc-300 opacity-60" : `border-l-4 ${
                e.severity === "CRITICAL" ? "border-red-500" :
                e.severity === "HIGH"     ? "border-red-400" :
                e.severity === "MEDIUM"   ? "border-orange-400" :
                                            "border-yellow-400"
              }`
            }`}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              {/* Left column */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-800">{e.username}</span>
                  <span className={`rounded border px-2 py-0.5 text-xs font-bold ${SEVERITY_STYLES[e.severity]}`}>
                    {e.severity}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {REASON_LABELS[e.reason] ?? e.reason}
                  </span>
                  {e.isResolved && (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      ✓ Resolved by {e.resolvedBy} on {e.resolvedAt ? fmt(e.resolvedAt) : "—"}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-zinc-400">
                  Flagged {fmt(e.createdAt)}
                  {e.updatedAt !== e.createdAt && ` · Updated ${fmt(e.updatedAt)}`}
                  &nbsp;·&nbsp;
                  <span className="font-mono">{e.userId.slice(0, 8)}…</span>
                </p>

                <EvidenceCard details={e.details} />
              </div>

              {/* Resolve button */}
              {!e.isResolved && (
                <button
                  onClick={() => resolve(e.id)}
                  disabled={resolving === e.id}
                  className="shrink-0 rounded border border-green-300 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100 disabled:opacity-50"
                >
                  {resolving === e.id ? "Resolving…" : "✓ Resolve"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm text-zinc-600">
          <button
            onClick={() => fetchEntries(page - 1)}
            disabled={page <= 1 || isFetching}
            className="border border-zinc-300 px-3 py-1 hover:bg-zinc-50 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span>Page {page} / {totalPages} ({total} entries)</span>
          <button
            onClick={() => fetchEntries(page + 1)}
            disabled={page >= totalPages || isFetching}
            className="border border-zinc-300 px-3 py-1 hover:bg-zinc-50 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
