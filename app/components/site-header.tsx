"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/auth-provider";
import { useAlbums } from "@/app/components/albums-provider";

type HeaderLink = {
  href: string;
  label: string;
};

type SiteHeaderProps = {
  links?: HeaderLink[];
};

const defaultLinks: HeaderLink[] = [
  { href: "/browse", label: "Browse" },
  { href: "/statistics", label: "Statistics" },
  { href: "/music-map", label: "Music Map" },
];

export function SiteHeader({ links }: SiteHeaderProps) {
  const { currentUser, signOut } = useAuth();
  const { isOnline, isServerReachable, isSyncing } = useAlbums();
  const navLinks = links ?? defaultLinks;

  // Suppress the banner during SSR / first hydration render to avoid mismatch
  // (isOnline & isServerReachable depend on browser APIs unavailable on the server).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const banner = !mounted
    ? null
    : isSyncing
      ? { msg: "⟳ Syncing offline changes to server…", cls: "bg-blue-100 text-blue-800" }
      : !isOnline
        ? { msg: "⚠ You are offline — changes will sync when reconnected", cls: "bg-amber-100 text-amber-800" }
        : !isServerReachable
          ? { msg: "⚠ Server unreachable — showing cached data, changes will sync on reconnect", cls: "bg-orange-100 text-orange-800" }
          : null;

  return (
    <header className="border-b border-zinc-200 bg-white">
      {banner && (
        <div className={`px-4 py-1.5 text-center text-xs font-medium ${banner.cls}`}>
          {banner.msg}
        </div>
      )}
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 text-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Album Atlas logo"
            className="w-8 h-auto"
          />
          <span className="text-lg font-medium leading-none sm:text-xl">Album Atlas</span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm text-zinc-700 sm:text-base"
        >
          {navLinks.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-zinc-900">
              {item.label}
            </Link>
          ))}

          {currentUser ? (
            <>
              {currentUser.role === "admin" && (
                <>
                  <Link
                    href="/admin/logs"
                    className="rounded bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700"
                  >
                    Logs
                  </Link>
                  <Link
                    href="/admin/observations"
                    className="rounded bg-red-700 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-800"
                  >
                    Observations
                  </Link>
                </>
              )}
              <span className="text-sm text-zinc-500">{currentUser.username}</span>
              <button
                type="button"
                onClick={signOut}
                className="border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="transition-colors hover:text-zinc-900">
                Login
              </Link>
              <Link href="/register" className="transition-colors hover:text-zinc-900">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
