import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { assertSharedAIKeyAccess } from "@/lib/ai/access-control";
import { createClient } from "@/lib/supabase/server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(createClient).mockReset();
});

describe("shared AI key access", () => {
  it("allows local development without adding a login requirement", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await expect(assertSharedAIKeyAccess()).resolves.toBeUndefined();
  });

  it("blocks an unauthenticated production deployment by default", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_PUBLIC_AI_API", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    await expect(assertSharedAIKeyAccess()).rejects.toMatchObject({ status: 401 });
  });

  it("accepts a signed-in Supabase user", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_PUBLIC_AI_API", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
    vi.mocked(createClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null }),
    } as never);

    await expect(assertSharedAIKeyAccess()).resolves.toBeUndefined();
  });

  it("blocks a signed-in user after the shared daily quota is exhausted", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_PUBLIC_AI_API", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
    vi.mocked(createClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: [{ allowed: false, retry_after_seconds: 120 }], error: null }),
    } as never);

    await expect(assertSharedAIKeyAccess()).rejects.toMatchObject({ status: 429, retryAfter: 120 });
  });
});
