"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth-provider";
import { API_BASE } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry {
  id:        string;
  userId:    string | null;
  username:  string | null;
  role:      string | null;
  action:    string;
  details:   Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface LogStats {
  totalEntries:        number;
  failedLoginsLastHour: number;
  activeUsersLast24h:  number;
  actionCounts:        { action: string; count: number }[];
}

interface LogsResponse {
  page:       number;
  pageSize:   number;
  total:      number;
  totalPages: number;
  entries:    LogEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  LOGIN:              "bg-green-100 text-green-800",
  LOGOUT:             "bg-zinc-100 text-zinc-600",
  REGISTER:           "bg-blue-100 text-blue-800",
  LOGIN_FAILED:       "bg-red-100 text-red-700",
  CREATE_ALBUM:       "bg-indigo-100 text-indigo-800",
  UPDATE_ALBUM:       "bg-yellow-100 text-yellow-800",
  DELETE_ALBUM:       "bg-orange-100 text-orange-800",
  CREATE_REVIEW:      "bg-purple-100 text-purple-800",
  DELETE_REVIEW:      "bg-rose-100 text-rose-700",
  RESOLVE_OBSERVATION:"bg-teal-100 text-teal-800",
  VIEW_LOGS:          "bg-slate-100 text-slate-600",
  VIEW_OBSERVATIONS:  "bg-slate-100 text-slate-600",
};

const ALL_ACTIONS = [
  "LOGIN","LOGOUT","REGISTER","LOGIN_FAILED",
  "CREATE_ALBUM","UPDATE_ALBUM","DELETE_ALBUM",
  "CREATE_REVIEW","DELETE_REVIEW",
  "RESOLVE_OBSERVATION","VIEW_LOGS","VIEW_OBSERVATIONS",
];

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], {
    dateStyle: "short", timeStyle: "medium",
  });
}

function DetailPill({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return null;
  const keys = Object.keys(details).filter((k) => details[k] !== undefined && details[k] !== null);
  if (keys.length === 0) return null;
  return (
    <span className="text-[10px] text-zinc-400">
      {keys.map((k) => `${k}: ${String(details[k])}`).join("  •  ")}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminLogsPage() {
  const { currentUser, isLoading } = useAuth();
  const router = useRouter();

  const [entries,    setEntries   ] = useState<LogEntry[]>([]);
  const [stats,      setStats     ] = useState<LogStats | null>(null);
  const [total,      setTotal     ] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage      ] = useState(1);
  const [isFetching, setIsFetching] = useState(false);

  // Filters
  const [filterAction,   setFilterAction  ] = useState("");
  const [filterUsername, setFilterUsername] = useState("");
  const [filterFrom,     setFilterFrom    ] = useState("");
  const [filterTo,       setFilterTo      ] = useState("");

  const PAGE_SIZE = 50;

  // Guard: admins only
  useEffect(() => {
    if (!isLoading && (!currentUser || currentUser.role !== "admin")) {
      router.replace("/");
    }
  }, [currentUser, isLoading, router]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/logs/stats`, { credentials: "include" });
      if (res.ok) setStats(await res.json() as LogStats);
    } catch { /* ignore */ }
  }, []);

  const fetchLogs = useCallback(async (p: number) => {
    setIsFetching(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (filterAction)   params.set("action",   filterAction);
      if (filterUsername) params.set("username", filterUsername);
      if (filterFrom)     params.set("from",     filterFrom);
      if (filterTo)       params.set("to",       filterTo);

      const res = await fetch(`${API_BASE}/api/logs?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as LogsResponse;
        setEntries(data.entries);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(data.page);
      }
    } finally {
      setIsFetching(false);
    }
  }, [filterAction, filterUsername, filterFrom, filterTo]);

  useEffect(() => {
    if (currentUser?.role === "admin") {
      void fetchStats();
      void fetchLogs(1);
    }
  }, [currentUser, fetchStats, fetchLogs]);

  if (isLoading || !currentUser || currentUser.role !== "admin") {
    return <div className="flex h-screen items-center justify-center text-zinc-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-800">Audit Log</h1>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total entries",         value: stats.totalEntries.toLocaleString() },
            { label: "Failed logins (1 h)",   value: stats.failedLoginsLastHour, hi: stats.failedLoginsLastHour > 10 },
            { label: "Active users (24 h)",   value: stats.activeUsersLast24h },
            { label: "Top action",            value: stats.actionCounts[0]?.action ?? "—" },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded border p-4 ${(s as { hi?: boolean }).hi ? "border-red-300 bg-red-50" : "border-zinc-200 bg-white"}`}
            >
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className={`mt-1 text-xl font-bold ${(s as { hi?: boolean }).hi ? "text-red-600" : "text-zinc-800"}`}>
                {String(s.value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">All actions</option>
          {ALL_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <input
          value={filterUsername}
          onChange={(e) => setFilterUsername(e.target.value)}
          placeholder="Username…"
          className="border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />

        <input
          type="datetime-local"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          className="border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <input
          type="datetime-local"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          className="border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />

        <button
          onClick={() => fetchLogs(1)}
          disabled={isFetching}
          className="bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {isFetching ? "Loading…" : "Apply"}
        </button>
        <button
          onClick={() => {
            setFilterAction(""); setFilterUsername("");
            setFilterFrom(""); setFilterTo("");
          }}
          className="border border-zinc-300 px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          Clear
        </button>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              {["Timestamp", "User", "Role", "Action", "IP", "Details"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-zinc-400">
                  {isFetching ? "Loading…" : "No entries found."}
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-zinc-50">
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-500">
                  {fmt(e.createdAt)}
                </td>
                <td className="px-4 py-2">
                  <span className="font-medium text-zinc-800">{e.username ?? "—"}</span>
                  {e.userId && (
                    <span className="ml-1 font-mono text-[10px] text-zinc-400">
                      {e.userId.slice(0, 8)}…
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {e.role && (
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      e.role === "ADMIN" ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700"
                    }`}>
                      {e.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ACTION_COLORS[e.action] ?? "bg-zinc-100 text-zinc-700"}`}>
                    {e.action}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-zinc-400">
                  {e.ipAddress ?? "—"}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  <DetailPill details={e.details} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm text-zinc-600">
          <button
            onClick={() => fetchLogs(page - 1)}
            disabled={page <= 1 || isFetching}
            className="border border-zinc-300 px-3 py-1 hover:bg-zinc-50 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span>Page {page} / {totalPages} &nbsp;({total.toLocaleString()} entries)</span>
          <button
            onClick={() => fetchLogs(page + 1)}
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
