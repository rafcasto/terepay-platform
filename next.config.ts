import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the Turbopack workspace root to this project directory. Without this,
// Next infers the root from the nearest lockfile, which can climb above the
// repo (e.g. a stray lockfile in $HOME, or a git worktree sharing a parent
// repo) and resolve convention files like `src/middleware.ts` from the wrong
// tree. Anchoring the root keeps module resolution deterministic.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  serverExternalPackages: ['firebase-admin', '@google-cloud/firestore', '@opentelemetry/api'],
};

export default nextConfig;
