"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAlbums } from "@/app/components/albums-provider";
import { SiteHeader } from "@/app/components/site-header";
import { getAlbumsForGenreSelection } from "@/app/music-map/music-map-logic";
import { MusicMapView } from "@/app/music-map/music-map-view";
import { getJsonCookie, setJsonCookie } from "@/lib/cookies";

const NODE_CLICKS_COOKIE = "music_map_clicks";

type ClickCounts = Record<string, number>;

export default function MusicMapPage() {
  const { albums } = useAlbums();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [clickCounts, setClickCounts] = useState<ClickCounts>({});

  useEffect(() => {
    setClickCounts(getJsonCookie<ClickCounts>(NODE_CLICKS_COOKIE) ?? {});
  }, []);

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setClickCounts((prev) => {
      const next = { ...prev, [nodeId]: (prev[nodeId] ?? 0) + 1 };
      setJsonCookie(NODE_CLICKS_COOKIE, next);
      return next;
    });
  }, []);

  const visibleAlbums = useMemo(() => getAlbumsForGenreSelection(albums, selectedNodeId), [albums, selectedNodeId]);

  return (
    <div className="min-h-screen bg-zinc-100">
      <SiteHeader />

      <main className="mx-auto max-w-[1680px] px-6 py-10">
        <MusicMapView
          selectedNodeId={selectedNodeId}
          onNodeSelect={handleNodeSelect}
          visibleAlbums={visibleAlbums}
          clickCounts={clickCounts}
        />
      </main>
    </div>
  );
}


