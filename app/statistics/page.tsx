"use client";

import { useEffect, useState } from "react";
import { useAlbums } from "@/app/components/albums-provider";
import { useAuth } from "@/app/components/auth-provider";
import { SiteHeader } from "@/app/components/site-header";
import { getStatisticsData } from "@/app/statistics/statistics-logic";
import { StatisticsView } from "@/app/statistics/statistics-view";
import { getCookie, setCookie } from "@/lib/cookies";
import {
  fetchGeneratorStatus,
  startGenerator,
  stopGenerator,
} from "@/lib/api-client";

const STATS_MODE_COOKIE = "stats_view_mode";

export default function StatisticsPage() {
  const { albums, refreshAlbums } = useAlbums();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [mode, setMode] = useState<"visual" | "tabular">("visual");
  const [generatorRunning, setGeneratorRunning] = useState(false);
  const [generatorBusy, setGeneratorBusy] = useState(false);

  useEffect(() => {
    const saved = getCookie(STATS_MODE_COOKIE);
    if (saved === "tabular") setMode("tabular");
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchGeneratorStatus()
      .then((s) => setGeneratorRunning(s.running))
      .catch(() => { /* offline — ignore */ });
  }, [isAdmin]);

  function handleModeChange(next: "visual" | "tabular") {
    setMode(next);
    setCookie(STATS_MODE_COOKIE, next);
  }

  async function handleToggleGenerator() {
    setGeneratorBusy(true);
    try {
      if (generatorRunning) {
        await stopGenerator();
        setGeneratorRunning(false);
      } else {
        await startGenerator();
        setGeneratorRunning(true);
        // first batch fires immediately; refresh after a short pause
        setTimeout(refreshAlbums, 2000);
      }
    } catch {
      // ignore
    } finally {
      setGeneratorBusy(false);
    }
  }

  const data = getStatisticsData(albums);

  return (
    <div className="min-h-screen bg-zinc-100">
      <SiteHeader />

      <main className="mx-auto max-w-[1680px] px-6 py-10">
        {/* Faker generator control — admin only */}
        {isAdmin && (
          <div className="mb-6 flex items-center gap-4 rounded border border-zinc-200 bg-white px-5 py-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-800">Album Generator</p>
              <p className="text-xs text-zinc-500">
                {generatorRunning
                  ? "▶ Running — adding 3 fake albums every 5 seconds via WebSocket"
                  : "Stopped — click Start to stream generated albums in real time"}
              </p>
            </div>
            <button
              type="button"
              disabled={generatorBusy}
              onClick={handleToggleGenerator}
              className={`px-5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                generatorRunning
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-700 hover:bg-green-800"
              }`}
            >
              {generatorBusy ? "…" : generatorRunning ? "Stop" : "Start"}
            </button>
          </div>
        )}

        <StatisticsView mode={mode} onModeChange={handleModeChange} data={data} />
      </main>
    </div>
  );
}
