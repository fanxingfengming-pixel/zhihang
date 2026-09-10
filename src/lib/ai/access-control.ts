import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { sendOperationalAlert } from "@/lib/observability";
import { requestIdentityHash, RequestSecurityError } from "@/lib/request-security";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type SharedAIReservationInput = {
  request: Request;
  requestId: string;
  agent: string;
  provider: "deepseek" | "qwen";
  model: string;
  estimatedTokens: number;
};

type QuotaRow = {
  allowed?: boolean;
  reason?: string;
  daily_remaining?: number;
  daily_tokens_remaining?: number;
  monthly_tokens_remaining?: number;
  minute_remaining?: number;
  identity_minute_remaining?: number;
  retry_after_seconds?: number;
  budget_warning?: string;
};

export type SharedAIReservation = {
  requestId: string;
  provider: "deepseek" | "qwen";
  model: string;
  budgetWarning?: string;
  remaining: {
    dailyRequests?: number;
    dailyTokens?: number;
    monthlyTokens?: number;
  };
};

function quotaErrorMessage(reason?: string) {
  if (reason === "daily_requests") return "今天的共享模型调用次数已用完，请明天再试或使用自己的 API 密钥。";
  if (reason === "daily_tokens") return "今天的共享模型 Token 额度已用完，请明天再试或使用自己的 API 密钥。";
  if (reason === "monthly_tokens") return "本月共享模型预算已用完，请联系管理员或使用自己的 API 密钥。";
  if (reason === "concurrent") return "当前账号同时运行的 AI 任务过多，请等待已有任务完成后重试。";
  if (reason === "identity_minute") return "当前网络的 AI 请求过于频繁，请稍后重试。";
  return "当前账号的共享模型额度已用完，请稍后再试或使用自己的 API 密钥。";
}

export function estimateAIRequestTokens(value: unknown, maxOutputTokens: number) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const estimatedInput = Math.ceil(serialized.length / 2);
  return Math.max(1, Math.min(200_000, estimatedInput + maxOutputTokens));
}

export async function assertSharedAIKeyAccess(
  reservationInput?: SharedAIReservationInput,
): Promise<SharedAIReservation | null> {
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_PUBLIC_AI_API === "true") return null;
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

  const { data: quotaRows, error: quotaError } = reservationInput
    ? await supabase.rpc("reserve_ai_usage", {
      p_request_id: reservationInput.requestId,
      p_identity_hash: requestIdentityHash(reservationInput.request),
      p_scope: "shared-ai",
      p_agent: reservationInput.agent,
      p_provider: reservationInput.provider,
      p_model: reservationInput.model,
      p_estimated_tokens: reservationInput.estimatedTokens,
    })
    : await supabase.rpc("consume_ai_quota");
  if (quotaError) {
    throw new RequestSecurityError("模型额度服务暂时不可用，请稍后重试。", 503);
  }
  const quota = (Array.isArray(quotaRows) ? quotaRows[0] : quotaRows) as QuotaRow | null;
  if (!quota?.allowed) {
    throw new RequestSecurityError(
      quotaErrorMessage(quota?.reason),
      429,
      Math.max(1, Number(quota?.retry_after_seconds) || 60),
    );
  }
  if (!reservationInput) return null;
  if (quota.budget_warning) {
    void sendOperationalAlert({
      type: "ai_budget_warning",
      requestId: reservationInput.requestId,
      warning: quota.budget_warning,
    });
  }
  return {
    requestId: reservationInput.requestId,
    provider: reservationInput.provider,
    model: reservationInput.model,
    budgetWarning: quota.budget_warning || undefined,
    remaining: {
      dailyRequests: quota.daily_remaining,
      dailyTokens: quota.daily_tokens_remaining,
      monthlyTokens: quota.monthly_tokens_remaining,
    },
  };
}

function pricePerMillion(provider: "deepseek" | "qwen", kind: "input" | "output") {
  const prefix = provider === "qwen" ? "QWEN" : "DEEPSEEK";
  const value = Number(process.env[`${prefix}_${kind.toUpperCase()}_COST_CNY_PER_M_TOKENS`]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function calculateAICostMicrounits(
  provider: "deepseek" | "qwen",
  promptTokens?: number,
  completionTokens?: number,
) {
  const inputPrice = pricePerMillion(provider, "input");
  const outputPrice = pricePerMillion(provider, "output");
  if (inputPrice === null || outputPrice === null) return null;
  return Math.max(0, Math.round(
    ((promptTokens || 0) * inputPrice + (completionTokens || 0) * outputPrice),
  ));
}

export async function finalizeSharedAIUsage(
  reservation: SharedAIReservation | null,
  result: {
    status: "success" | "error";
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    durationMs: number;
    errorType?: string;
  },
) {
  if (!reservation || !isSupabaseAdminConfigured()) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("finalize_ai_usage", {
      p_request_id: reservation.requestId,
      p_status: result.status,
      p_prompt_tokens: result.promptTokens ?? null,
      p_completion_tokens: result.completionTokens ?? null,
      p_total_tokens: result.totalTokens ?? null,
      p_cost_microunits: calculateAICostMicrounits(
        reservation.provider,
        result.promptTokens,
        result.completionTokens,
      ),
      p_duration_ms: Math.max(0, Math.round(result.durationMs)),
      p_error_type: result.errorType?.slice(0, 120) || null,
    });
    if (error) throw error;
  } catch (error) {
    console.error(JSON.stringify({
      event: "ai_usage_finalize_failed",
      timestamp: new Date().toISOString(),
      requestId: reservation.requestId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    }));
  }
}
