export type ReadinessCheck = {
  key: string;
  label: string;
  ok: boolean;
  required: boolean;
};

function present(value?: string) {
  return Boolean(value?.trim());
}

function positiveNumber(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function httpsUrl(value?: string) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function getProductionReadiness(env: Record<string, string | undefined> = process.env) {
  const provider = env.AI_PROVIDER === "deepseek" ? "deepseek" : "qwen";
  const prefix = provider === "qwen" ? "QWEN" : "DEEPSEEK";
  const checks: ReadinessCheck[] = [
    { key: "model_key", label: `${provider === "qwen" ? "Qwen" : "DeepSeek"} 服务端密钥`, ok: present(env[`${prefix}_API_KEY`]), required: true },
    { key: "supabase_public", label: "Supabase URL 与 Publishable Key", ok: present(env.NEXT_PUBLIC_SUPABASE_URL) && present(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), required: true },
    { key: "supabase_admin", label: "Supabase Secret Key", ok: present(env.SUPABASE_SECRET_KEY) || present(env.SUPABASE_SERVICE_ROLE_KEY), required: true },
    { key: "turnstile", label: "登录 CAPTCHA 前端 Site Key", ok: present(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), required: true },
    { key: "public_ai_guard", label: "匿名共享模型调用保持关闭", ok: env.ALLOW_PUBLIC_AI_API !== "true", required: true },
    { key: "runtime_key_guard", label: "生产网页临时密钥保持关闭", ok: env.ALLOW_RUNTIME_API_KEYS !== "true", required: true },
    { key: "cron_secret", label: "岗位定时任务密钥", ok: present(env.CRON_SECRET), required: true },
    { key: "rate_limit_secret", label: "限流身份哈希密钥", ok: present(env.RATE_LIMIT_HASH_SECRET) && (env.RATE_LIMIT_HASH_SECRET?.trim().length || 0) >= 32, required: true },
    { key: "health_secret", label: "深度健康检查密钥", ok: present(env.HEALTHCHECK_SECRET) && (env.HEALTHCHECK_SECRET?.trim().length || 0) >= 32, required: true },
    { key: "cost_pricing", label: "模型 Token 成本单价", ok: positiveNumber(env[`${prefix}_INPUT_COST_CNY_PER_M_TOKENS`]) && positiveNumber(env[`${prefix}_OUTPUT_COST_CNY_PER_M_TOKENS`]), required: true },
    { key: "alert_webhook", label: "预算与故障告警 Webhook", ok: httpsUrl(env.AI_ALERT_WEBHOOK_URL), required: true },
  ];
  return {
    provider,
    ready: checks.every((check) => !check.required || check.ok),
    checks,
  };
}
