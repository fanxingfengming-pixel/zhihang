import { generateJson, hasProviderKey, type Provider } from "@/lib/ai/client";
import { getRuntimeAISettings } from "@/lib/ai/runtime-settings";
import { buildAgentUserMessage, prompts } from "@/lib/ai/prompts";
import { demoResult } from "@/lib/demo";
import { secureAgentResult } from "@/lib/agent-guards";
import { AGENT_OUTPUT_SCHEMAS, isAgentName } from "@/lib/agent-registry";
import {
  looksLikePromptLeakage,
  privateJson,
  protectMutation,
  readJsonWithLimit,
  redactSecrets,
  RequestSecurityError,
  requestSecurityError,
} from "@/lib/request-security";
import { AgentRequestSchema } from "@/lib/schemas";
import { ZodError } from "zod";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function parseModelJson(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as unknown;
}

export async function POST(request: Request, { params }: { params: Promise<{ agent: string }> }) {
  try {
    protectMutation(request, "agent", { limit: 30 });
    const { agent } = await params;
    if (!isAgentName(agent)) return privateJson({ error: "未知 Agent" }, { status: 404 });

    const body = AgentRequestSchema.parse(await readJsonWithLimit(request, 256 * 1024));
    const sessionId = (await cookies()).get("zhihang_ai_session")?.value;
    const runtimeSettings = getRuntimeAISettings(sessionId);
    const provider = (runtimeSettings?.provider || body.provider || process.env.AI_PROVIDER || "deepseek") as Provider;
    if (provider !== "deepseek" && provider !== "qwen") {
      return privateJson({ error: "AI_PROVIDER 仅支持 deepseek 或 qwen" }, { status: 400 });
    }

    const useDemo = runtimeSettings
      ? runtimeSettings.demoMode || !hasProviderKey(provider, runtimeSettings)
      : process.env.DEMO_MODE === "true" || !hasProviderKey(provider);
    let result: unknown;
    if (useDemo) {
      result = demoResult(agent, body.input, body.context);
    } else {
      const raw = await generateJson(
        provider,
        prompts[agent],
        buildAgentUserMessage(body.input, body.context),
        runtimeSettings,
      );
      if (looksLikePromptLeakage(raw)) {
        throw new RequestSecurityError("模型输出触发安全校验，请重试。", 502);
      }
      result = parseModelJson(raw);
    }

    const parsed = AGENT_OUTPUT_SCHEMAS[agent].parse(redactSecrets(result));
    const validated = secureAgentResult(agent, body.input, body.context, parsed);
    return privateJson({ data: validated, meta: { provider: useDemo ? "demo" : provider, demo: useDemo } });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityError(error);
    if (error instanceof ZodError) {
      return privateJson({ error: "请求或模型输出格式不符合要求" }, { status: 422 });
    }
    if (error instanceof SyntaxError) {
      return privateJson({ error: "模型返回的不是合法 JSON，请重试" }, { status: 502 });
    }
    return privateJson({ error: "AI 服务调用失败，请到设置页检查服务商、模型和密钥后重试。" }, { status: 502 });
  }
}
