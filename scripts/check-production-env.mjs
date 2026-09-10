const provider = process.env.AI_PROVIDER === "deepseek" ? "DEEPSEEK" : "QWEN";
const required = [
  [`${provider}_API_KEY`, "默认模型服务端密钥"],
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase 项目地址"],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "Supabase Publishable Key"],
  ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "Cloudflare Turnstile Site Key"],
  ["CRON_SECRET", "岗位定时任务密钥"],
  ["RATE_LIMIT_HASH_SECRET", "限流身份哈希密钥"],
  ["HEALTHCHECK_SECRET", "深度健康检查密钥"],
  [`${provider}_INPUT_COST_CNY_PER_M_TOKENS`, "模型输入 Token 单价"],
  [`${provider}_OUTPUT_COST_CNY_PER_M_TOKENS`, "模型输出 Token 单价"],
  ["AI_ALERT_WEBHOOK_URL", "预算与故障告警地址"],
];

const missing = required.filter(([key]) => !process.env[key]?.trim());
if (!process.env.SUPABASE_SECRET_KEY?.trim() && !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  missing.push(["SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY", "Supabase 管理员密钥"]);
}
const unsafe = [
  ...(process.env.ALLOW_PUBLIC_AI_API === "true" ? ["ALLOW_PUBLIC_AI_API 不应在公开生产环境设为 true"] : []),
  ...(process.env.ALLOW_RUNTIME_API_KEYS === "true" ? ["ALLOW_RUNTIME_API_KEYS 不应在多实例生产环境设为 true"] : []),
  ...(["RATE_LIMIT_HASH_SECRET", "HEALTHCHECK_SECRET"].filter((key) => {
    const value = process.env[key]?.trim();
    return value && value.length < 32;
  }).map((key) => `${key} 至少需要 32 个字符`)),
];

if (missing.length || unsafe.length) {
  console.error("生产配置尚未就绪：");
  for (const [key, label] of missing) console.error(`- 缺少 ${key}（${label}）`);
  for (const issue of unsafe) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`生产配置检查通过，默认服务商：${provider === "QWEN" ? "Qwen" : "DeepSeek"}。`);
}
