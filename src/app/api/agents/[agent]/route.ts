import { randomUUID } from "node:crypto";
import { configuredModel, DEFAULT_PROVIDER, generateJsonWithMetrics, hasProviderKey, isAllowedSharedModel, type Provider } from "@/lib/ai/client";
import {
  assertSharedAIKeyAccess,
  estimateAIRequestTokens,
  finalizeSharedAIUsage,
  type SharedAIReservation,
} from "@/lib/ai/access-control";
import { getRuntimeAISettings, runtimeApiKeysAllowed } from "@/lib/ai/runtime-settings";
import { buildAgentUserMessage, prompts } from "@/lib/ai/prompts";
import { demoResult } from "@/lib/demo";
import { secureAgentResult } from "@/lib/agent-guards";
import { AGENT_OUTPUT_SCHEMAS, isAgentName } from "@/lib/agent-registry";
import {
  looksLikePromptLeakage,
  privateJson,
  protectAIDataConsent,
  protectMutation,
  readJsonWithLimit,
  redactSecrets,
  RequestSecurityError,
  requestSecurityError,
} from "@/lib/request-security";
import { AgentRequestSchema } from "@/lib/schemas";
import { logAIRequest } from "@/lib/observability";
import { ZodError } from "zod";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function parseModelJson(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as unknown;
}

export async function POST(request: Request, { params }: { params: Promise<{ agent: string }> }) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let logAgent = "unknown";
  let logProvider = "unknown";
  let logModel: string | undefined;
  let logDemo = true;
  let reservation: SharedAIReservation | null = null;
  try {
    protectMutation(request, "agent", { limit: 30 });
    const { agent } = await params;
    logAgent = agent;
    if (!isAgentName(agent)) return privateJson({ error: "未知 Agent" }, { status: 404 });

    const body = AgentRequestSchema.parse(await readJsonWithLimit(request, 256 * 1024));
    const sessionId = (await cookies()).get("zhihang_ai_session")?.value;
    const savedRuntimeSettings = getRuntimeAISettings(sessionId);
    const runtimeSettings = savedRuntimeSettings
      ? { ...savedRuntimeSettings, apiKey: runtimeApiKeysAllowed() ? savedRuntimeSettings.apiKey : "" }
      : undefined;
    const provider = (runtimeSettings?.provider || body.provider || process.env.AI_PROVIDER || DEFAULT_PROVIDER) as Provider;
    logProvider = provider;
    logModel = runtimeSettings?.model || configuredModel(provider);
    if (provider !== "deepseek" && provider !== "qwen") {
      return privateJson({ error: "AI_PROVIDER 仅支持 deepseek 或 qwen" }, { status: 400 });
    }

    const useDemo = runtimeSettings
      ? runtimeSettings.demoMode || !hasProviderKey(provider, runtimeSettings)
      : process.env.DEMO_MODE === "true" || !hasProviderKey(provider);
    logDemo = useDemo;
    protectAIDataConsent(request, useDemo);
    const usesSessionKey = Boolean(runtimeSettings?.apiKey.trim());
    if (!useDemo && !usesSessionKey) {
      if (runtimeSettings?.model && !isAllowedSharedModel(provider, runtimeSettings.model)) {
        throw new RequestSecurityError("平台共享密钥不支持该模型，请选择管理员允许的模型或填写自己的 API 密钥。", 400);
      }
      reservation = await assertSharedAIKeyAccess({
        request,
        requestId,
        agent,
        provider,
        model: logModel,
        estimatedTokens: estimateAIRequestTokens(body, 2_500),
      });
    }
    let result: unknown;
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
    if (useDemo) {
      result = demoResult(agent, body.input, body.context);
    } else {
      const generation = await generateJsonWithMetrics(
        provider,
        prompts[agent],
        buildAgentUserMessage(body.input, body.context),
        runtimeSettings,
      );
      const raw = generation.content;
      usage = generation.usage;
      if (looksLikePromptLeakage(raw)) {
        throw new RequestSecurityError("模型输出触发安全校验，请重试。", 502);
      }
      result = parseModelJson(raw);
    }

    const parsed = AGENT_OUTPUT_SCHEMAS[agent].parse(redactSecrets(result));
    const validated = secureAgentResult(agent, body.input, body.context, parsed);
    await finalizeSharedAIUsage(reservation, {
      status: "success",
      durationMs: Date.now() - startedAt,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
    });
    logAIRequest({
      requestId,
      agent,
      provider: useDemo ? "demo" : provider,
      model: useDemo ? undefined : logModel,
      demo: useDemo,
      status: "success",
      durationMs: Date.now() - startedAt,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
    });
    return privateJson({
      data: validated,
      meta: {
        provider: useDemo ? "demo" : provider,
        demo: useDemo,
        requestId,
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        } : undefined,
        quota: reservation?.remaining,
      },
    });
  } catch (error) {
    await finalizeSharedAIUsage(reservation, {
      status: "error",
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    logAIRequest({
      requestId,
      agent: logAgent,
      provider: logProvider,
      model: logModel,
      demo: logDemo,
      status: "error",
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    if (error instanceof RequestSecurityError) return requestSecurityError(error, requestId);
    if (error instanceof ZodError) {
      return privateJson({ error: "请求或模型输出格式不符合要求", requestId }, { status: 422 });
    }
    if (error instanceof SyntaxError) {
      return privateJson({ error: "模型返回的不是合法 JSON，请重试", requestId }, { status: 502 });
    }
    return privateJson({ error: "AI 服务调用失败，请到设置页检查服务商、模型和密钥后重试。", requestId }, { status: 502 });
  }
}
