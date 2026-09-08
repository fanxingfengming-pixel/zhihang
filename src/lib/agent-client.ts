import type { AgentName } from "@/lib/schemas";
import { hasAIDataConsent } from "@/lib/ai-data-consent";

export type AgentMeta = {
  provider: string;
  demo: boolean;
};

type AgentSuccess<T> = {
  data: T;
  meta: AgentMeta;
};

type AgentFailure = {
  error?: string;
};

export async function runAgent<T>(agent: AgentName, input: unknown, context?: unknown): Promise<AgentSuccess<T>> {
  const response = await fetch(`/api/agents/${agent}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Zhihang-AI-Data-Consent": hasAIDataConsent() ? "granted" : "missing",
    },
    body: JSON.stringify({ input, context }),
  });
  const payload = (await response.json()) as AgentSuccess<T> | AgentFailure;
  if (!response.ok || !("data" in payload)) {
    throw new Error("error" in payload && payload.error ? payload.error : `${agent} Agent 调用失败`);
  }
  return payload;
}
