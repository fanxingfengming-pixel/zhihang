import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const proxySource = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
const sessionProxySource = readFileSync(new URL("../src/lib/supabase/proxy.ts", import.meta.url), "utf8");

describe("Supabase session refresh coverage", () => {
  it("refreshes auth cookies and enforces authentication across application routes", () => {
    expect(proxySource).toContain("/((?!_next/static|_next/image|favicon.ico|");
    expect(sessionProxySource).toContain("supabase.auth.getClaims()");
    expect(sessionProxySource).toContain("请先登录后再使用此功能");
  });

  it("keeps only login, auth confirmation, health and signed cron entry points public", () => {
    expect(sessionProxySource).toContain('new Set(["/login", "/verify-email", "/auth/confirm", "/auth/confirmed"])');
    expect(sessionProxySource).toContain('new Set(["/api/health", "/api/cron/jobs"])');
  });
});
