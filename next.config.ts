import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Cache Components is intentionally disabled: every page renders per-investor
// financial data that must be read fresh from PostgreSQL on each request.
const nextConfig: NextConfig = {
  // The Docker build sets NEXT_OUTPUT=standalone to get a self-contained server bundle.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  // With the saved dev cache, pages reloaded in an endless loop after the dev server was stopped, code changed and
  // the server started again (Next.js 16.4.6). Only affects `next dev`; try without this after a Next.js update.
  experimental: { turbopackFileSystemCacheForDev: false },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
