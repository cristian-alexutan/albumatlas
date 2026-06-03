"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api-client";
import type { Track } from "@/lib/api-client";

type TracksPanelProps = {
  albumId: string;
  canManage: boolean;
};

type FormState = { title: string; position: string; durationSec: string };
const EMPTY_FORM: FormState = { title: "", position: "", durationSec: "" };

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TracksPanel({ albumId, canManage }: TracksPanelProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTracks = useCallback(async () => {
    try {
      const data = await api.fetchTracks(albumId);
      setTracks(data);
    } catch {
      // offline or error: keep whatever is there
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  function trackToForm(t: Track): FormState {
    return { title: t.title, position: String(t.position), durationSec: String(t.durationSec) };
  }

  function validateForm(f: FormState): string | null {
    if (!f.title.trim()) return "Title is required.";
    const pos = Number(f.position);
    if (!Number.isInteger(pos) || pos < 1) return "Position must be a positive integer.";
    const dur = Number(f.durationSec);
    if (!Number.isInteger(dur) || dur < 1) return "Duration must be ≥ 1 second.";
    return null;
  }

  async function handleCreate() {
    const err = validateForm(form);
    if (err) { setError(err); return; }
    setError(null);
    try {
      const track = await api.createTrack(albumId, {
        title: form.title.trim(),
        position: Number(form.position),
        durationSec: Number(form.durationSec),
      });
      setTracks((prev) => [...prev, track].sort((a, b) => a.position - b.position));
      setForm(EMPTY_FORM);
      setShowAdd(false);
    } catch { setError("Failed to create track."); }
  }

  async function handleUpdate(id: string) {
    const err = validateForm(form);
    if (err) { setError(err); return; }
    setError(null);
    try {
      const updated = await api.updateTrack(id, {
        title: form.title.trim(),
        position: Number(form.position),
        durationSec: Number(form.durationSec),
      });
      setTracks((prev) =>
        prev.map((t) => (t.id === id ? updated : t)).sort((a, b) => a.position - b.position),
      );
      setEditingId(null);
    } catch { setError("Failed to update track."); }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this track?")) return;
    try {
      await api.deleteTrack(id);
      setTracks((prev) => prev.filter((t) => t.id !== id));
    } catch { setError("Failed to delete track."); }
  }

  const totalDuration = tracks.reduce((s, t) => s + t.durationSec, 0);

  return (
    <div className="mt-6 border-t border-zinc-300 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-zinc-900">
          Tracklist {!loading && <span className="ml-2 text-sm font-normal text-zinc-500">({tracks.length} tracks · {fmtDuration(totalDuration)})</span>}
        </h2>
        {canManage && !showAdd && (
          <button
            type="button"
            onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); setError(null); }}
            className="text-sm border border-zinc-300 bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
          >
            + Add Track
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-3 text-zinc-500">Loading tracks…</p>
      ) : (
        <ol className="mt-3 divide-y divide-zinc-200">
          {tracks.map((track) => (
            <li key={track.id} className="flex items-center gap-4 py-2 text-sm text-zinc-700">
              {editingId === track.id ? (
                <>
                  <span className="w-6 shrink-0 text-right text-zinc-400">{track.position}.</span>
                  <input
                    className="flex-1 border border-zinc-300 px-2 py-1 text-sm"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Title"
                  />
                  <input
                    className="w-16 border border-zinc-300 px-2 py-1 text-sm"
                    value={form.position}
                    onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                    placeholder="#"
                    type="number" min={1}
                  />
                  <input
                    className="w-20 border border-zinc-300 px-2 py-1 text-sm"
                    value={form.durationSec}
                    onChange={(e) => setForm((f) => ({ ...f, durationSec: e.target.value }))}
                    placeholder="sec"
                    type="number" min={1}
                  />
                  <button type="button" onClick={() => handleUpdate(track.id)} className="text-xs text-green-700 hover:underline">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-zinc-500 hover:underline">Cancel</button>
                </>
              ) : (
                <>
                  <span className="w-6 shrink-0 text-right text-zinc-400">{track.position}.</span>
                  <span className="flex-1">{track.title}</span>
                  <span className="text-zinc-500">{fmtDuration(track.durationSec)}</span>
                  {canManage && (
                    <>
                      <button type="button" onClick={() => { setEditingId(track.id); setForm(trackToForm(track)); setError(null); }} className="text-xs text-zinc-500 hover:underline">Edit</button>
                      <button type="button" onClick={() => handleDelete(track.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}

          {tracks.length === 0 && (
            <li className="py-4 text-center text-zinc-500">No tracks yet.</li>
          )}
        </ol>
      )}

      {/* Add track form */}
      {showAdd && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Title</label>
            <input
              className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Track title"
            />
          </div>
          <div className="w-20">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Position</label>
            <input
              className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="#"
              type="number" min={1}
            />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Duration (sec)</label>
            <input
              className="w-full border border-zinc-300 px-2 py-1.5 text-sm"
              value={form.durationSec}
              onChange={(e) => setForm((f) => ({ ...f, durationSec: e.target.value }))}
              placeholder="sec"
              type="number" min={1}
            />
          </div>
          <button type="button" onClick={handleCreate} className="bg-zinc-700 px-4 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800">Add</button>
          <button type="button" onClick={() => { setShowAdd(false); setError(null); }} className="px-3 py-1.5 text-sm text-zinc-600 hover:underline">Cancel</button>
        </div>
      )}
    </div>
  );
}
