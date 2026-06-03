import type { NextConfig } from "next";

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Only proxy through Next.js rewrites in local dev (when no external API URL is set).
// On Vercel, NEXT_PUBLIC_API_URL points directly to Railway so rewrites aren't needed.
const apiBase = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "";
const useRewrites = !apiBase || apiBase === "http://localhost:4000";

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  ...(useRewrites
    ? {
        async rewrites() {
          const base = "http://localhost:4000";
          return [
            { source: "/api/:path*", destination: `${base}/api/:path*` },
            { source: "/graphql",    destination: `${base}/graphql` },
          ];
        },
      }
    : {}),
};

export default nextConfig;
