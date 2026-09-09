import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const proxySource = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");

describe("Supabase session refresh coverage", () => {
  it("refreshes auth cookies for every route that reads Supabase identity", () => {
    for (const route of [
      "/settings/:path*",
      "/api/sync/:path*",
      "/api/agents/:path*",
      "/api/settings/ai/:path*",
      "/api/account/:path*",
      "/auth/:path*",
    ]) {
      expect(proxySource).toContain(`"${route}"`);
    }
  });
});
