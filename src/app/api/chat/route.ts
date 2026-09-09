import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { assertSharedAIKeyAccess } from "@/lib/ai/access-control";
import {
  DEFAULT_PROVIDER,
  generateTextWithMetrics,
  hasProviderKey,
  isAllowedSharedModel,
  type Provider,
} from "@/lib/ai/client";
import { buildFreeChatMessages, demoFreeChatReply, FREE_CHAT_SYSTEM_PROMPT } from "@/lib/ai/free-chat";
import { getRuntimeAISettings, runtimeApiKeysAllowed } from "@/lib/ai/runtime-settings";
import { logAIRequest } from "@/lib/observability";
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
import { FreeChatRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let logProvider = "unknown";
  let logModel: string | undefined;
  let logDemo = true;

  try {
    protectMutation(request, "agent-chat", { limit: 15 });
    const body = FreeChatRequestSchema.parse(await readJsonWithLimit(request, 48 * 1024));
    const sessionId = (await cookies()).get("zhihang_ai_session")?.value;
    const savedRuntimeSettings = getRuntimeAISettings(sessionId);
    const runtimeSettings = savedRuntimeSettings
      ? { ...savedRuntimeSettings, apiKey: runtimeApiKeysAllowed() ? savedRuntimeSettings.apiKey : "" }
      : undefined;
    const configuredProvider = runtimeSettings?.provider || process.env.AI_PROVIDER || DEFAULT_PROVIDER;
    if (configuredProvider !== "deepseek" && configuredProvider !== "qwen") {
      return privateJson({ error: "AI_PROVIDER 仅支持 deepseek 或 qwen" }, { status: 400 });
    }
    const provider = configuredProvider as Provider;
    logProvider = provider;
    logModel = runtimeSettings?.model;

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
      await assertSharedAIKeyAccess();
    }

    let message: string;
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
    if (useDemo) {
      message = demoFreeChatReply(body);
    } else {
      const generation = await generateTextWithMetrics(
        provider,
        FREE_CHAT_SYSTEM_PROMPT,
        buildFreeChatMessages(body),
        runtimeSettings,
      );
      message = generation.content;
      usage = generation.usage;
      if (looksLikePromptLeakage(message)) {
        throw new RequestSecurityError("模型输出触发安全校验，请重试。", 502);
      }
    }

    const safeMessage = redactSecrets(message).trim().slice(0, 6_000);
    if (!safeMessage) throw new RequestSecurityError("模型没有返回可用内容，请重试。", 502);
    logAIRequest({
      requestId,
      agent: "free-chat",
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
      message: safeMessage,
      meta: {
        provider: useDemo ? "demo" : provider,
        demo: useDemo,
        requestId,
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        } : undefined,
      },
    });
  } catch (error) {
    logAIRequest({
      requestId,
      agent: "free-chat",
      provider: logProvider,
      model: logModel,
      demo: logDemo,
      status: "error",
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    if (error instanceof RequestSecurityError) return requestSecurityError(error, requestId);
    if (error instanceof ZodError) {
      return privateJson({ error: error.issues[0]?.message || "对话内容格式不符合要求", requestId }, { status: 422 });
    }
    return privateJson({ error: "自由对话调用失败，请到设置页检查 Qwen 模型和密钥后重试。", requestId }, { status: 502 });
  }
}
