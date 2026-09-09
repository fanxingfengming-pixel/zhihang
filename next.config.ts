import type { NextConfig } from "next";

const scriptPolicy = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const connectPolicy = process.env.NODE_ENV === "development"
  ? "connect-src 'self' ws: wss: https://*.supabase.co"
  : "connect-src 'self' wss://*.supabase.co https://*.supabase.co";
const contentSecurityPolicy = [
  "default-src 'self'",
  scriptPolicy,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  connectPolicy,
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // This workspace's project-level AGENTS.md is synced read-only.
  // Prevent Next.js 16.3+ from trying to inject its own managed block in dev.
  agentRules: false,
  serverExternalPackages: ["pdf-parse", "mammoth", "pdfkit"],
  outputFileTracingIncludes: {
    "/api/documents/export-resume": [
      "./node_modules/@fontsource/noto-sans-sc/unicode.json",
      "./node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-*-400-normal.woff",
    ],
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default nextConfig;
