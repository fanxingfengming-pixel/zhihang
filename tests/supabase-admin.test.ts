import { afterEach, describe, expect, it, vi } from "vitest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase admin key configuration", () => {
  it("prefers the current secret key configuration", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(isSupabaseAdminConfigured()).toBe(true);
  });

  it("keeps the legacy service role key compatible", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-test-key");
    expect(isSupabaseAdminConfigured()).toBe(true);
  });

  it("reports missing server credentials", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(isSupabaseAdminConfigured()).toBe(false);
  });
});
