import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // This workspace's project-level AGENTS.md is synced read-only.
  // Prevent Next.js 16.3+ from trying to inject its own managed block in dev.
  agentRules: false,
};

export default nextConfig;
