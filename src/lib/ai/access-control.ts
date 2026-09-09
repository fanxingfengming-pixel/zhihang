import { RequestSecurityError } from "@/lib/request-security";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function assertSharedAIKeyAccess() {
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_PUBLIC_AI_API === "true") return;
  if (!isSupabaseConfigured()) {
    throw new RequestSecurityError(
      "生产环境未开放共享模型密钥。请登录账号、填写自己的 API 密钥，或由管理员显式开启公开调用。",
      401,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    throw new RequestSecurityError("请先登录后再使用平台提供的模型额度。", 401);
  }

  const { data: quotaRows, error: quotaError } = await supabase.rpc("consume_ai_quota");
  if (quotaError) {
    throw new RequestSecurityError("模型额度服务暂时不可用，请稍后重试。", 503);
  }
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (!quota?.allowed) {
    throw new RequestSecurityError(
      "当前账号的共享模型额度已用完，请稍后再试或使用自己的 API 密钥。",
      429,
      Math.max(1, Number(quota?.retry_after_seconds) || 60),
    );
  }
}
