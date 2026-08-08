import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Avoid auto-generating AGENTS.md / CLAUDE.md in the repo root.
  agentRules: false,
} as NextConfig;

export default nextConfig;
