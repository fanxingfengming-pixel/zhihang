import { generateJson, hasProviderKey, type Provider } from "@/lib/ai/client";
import { getRuntimeAISettings } from "@/lib/ai/runtime-settings";
import { prompts } from "@/lib/ai/prompts";
import { demoResult } from "@/lib/demo";
import { secureAgentResult } from "@/lib/agent-guards";
import { AGENT_OUTPUT_SCHEMAS, isAgentName } from "@/lib/agent-registry";
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
    const { agent } = await params;
    if (!isAgentName(agent)) return Response.json({ error: "未知 Agent" }, { status: 404 });

    const body = AgentRequestSchema.parse(await request.json());
    const sessionId = (await cookies()).get("zhihang_ai_session")?.value;
    const runtimeSettings = getRuntimeAISettings(sessionId);
    const provider = (runtimeSettings?.provider || body.provider || process.env.AI_PROVIDER || "deepseek") as Provider;
    if (provider !== "deepseek" && provider !== "qwen") {
      return Response.json({ error: "AI_PROVIDER 仅支持 deepseek 或 qwen" }, { status: 400 });
    }

    const useDemo = runtimeSettings
      ? runtimeSettings.demoMode || !hasProviderKey(provider, runtimeSettings)
      : process.env.DEMO_MODE === "true" || !hasProviderKey(provider);
    const result = useDemo
      ? demoResult(agent, body.input, body.context)
      : parseModelJson(await generateJson(provider, prompts[agent], JSON.stringify({ input: body.input, context: body.context }), runtimeSettings));

    const parsed = AGENT_OUTPUT_SCHEMAS[agent].parse(result);
    const validated = secureAgentResult(agent, body.input, body.context, parsed);
    return Response.json({ data: validated, meta: { provider: useDemo ? "demo" : provider, demo: useDemo } });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "请求或模型输出格式不符合要求", details: error.issues }, { status: 422 });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "模型返回的不是合法 JSON，请重试" }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "服务器发生未知错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
