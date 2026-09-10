import { describe, expect, it } from "vitest";
import { getProductionReadiness } from "@/lib/production-readiness";

const completeEnv = {
  AI_PROVIDER: "qwen",
  QWEN_API_KEY: "server-key",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SECRET_KEY: "secret-key",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
  ALLOW_PUBLIC_AI_API: "false",
  ALLOW_RUNTIME_API_KEYS: "false",
  CRON_SECRET: "cron-secret",
  RATE_LIMIT_HASH_SECRET: "rate-limit-secret-with-at-least-32-characters",
  HEALTHCHECK_SECRET: "health-check-secret-with-at-least-32-characters",
  QWEN_INPUT_COST_CNY_PER_M_TOKENS: "0.8",
  QWEN_OUTPUT_COST_CNY_PER_M_TOKENS: "2",
  AI_ALERT_WEBHOOK_URL: "https://alerts.example/hooks/zhihang",
};

describe("production readiness", () => {
  it("passes only when cost, quota, Supabase and monitoring settings are complete", () => {
    expect(getProductionReadiness(completeEnv)).toMatchObject({ provider: "qwen", ready: true });
  });

  it("rejects unsafe public shared-key mode and missing operational controls", () => {
    const report = getProductionReadiness({ ...completeEnv, ALLOW_PUBLIC_AI_API: "true", AI_ALERT_WEBHOOK_URL: "" });
    expect(report.ready).toBe(false);
    expect(report.checks.filter((check) => !check.ok).map((check) => check.key)).toEqual([
      "public_ai_guard",
      "alert_webhook",
    ]);
  });
});
