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
    await expect(assertSharedAIKeyAccess()).resolves.toBeNull();
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

    await expect(assertSharedAIKeyAccess()).resolves.toBeNull();
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

  it("reserves distributed token, identity and concurrency quota without storing a raw IP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_PUBLIC_AI_API", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
    vi.stubEnv("RATE_LIMIT_HASH_SECRET", "a-secure-test-secret-that-is-long-enough");
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        allowed: true,
        daily_remaining: 49,
        daily_tokens_remaining: 198000,
        monthly_tokens_remaining: 1998000,
        retry_after_seconds: 0,
      }],
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null }) },
      rpc,
    } as never);

    const reservation = await assertSharedAIKeyAccess({
      request: new Request("https://app.example/api/chat", { headers: { "x-forwarded-for": "203.0.113.10" } }),
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      agent: "free-chat",
      provider: "qwen",
      model: "qwen-plus",
      estimatedTokens: 2_000,
    });

    expect(reservation?.remaining.dailyRequests).toBe(49);
    expect(rpc).toHaveBeenCalledWith("reserve_ai_usage", expect.objectContaining({
      p_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      p_agent: "free-chat",
      p_estimated_tokens: 2_000,
      p_identity_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("203.0.113.10");
  });

  it("fails closed when the production identity hash secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_PUBLIC_AI_API", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
    vi.stubEnv("RATE_LIMIT_HASH_SECRET", "");
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null }) },
      rpc,
    } as never);

    await expect(assertSharedAIKeyAccess({
      request: new Request("https://app.example/api/chat"),
      requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      agent: "free-chat",
      provider: "qwen",
      model: "qwen-plus",
      estimatedTokens: 1_000,
    })).rejects.toMatchObject({ status: 503 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
