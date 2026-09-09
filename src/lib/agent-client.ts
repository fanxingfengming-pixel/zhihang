import type { AgentName, FreeChatMessage } from "@/lib/schemas";
import { hasAIDataConsent } from "@/lib/ai-data-consent";

export type AgentMeta = {
  provider: string;
  demo: boolean;
  requestId?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
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

export async function runFreeChat(messages: FreeChatMessage[]): Promise<{ message: string; meta: AgentMeta }> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Zhihang-AI-Data-Consent": hasAIDataConsent() ? "granted" : "missing",
    },
    body: JSON.stringify({ messages }),
  });
  const payload = await response.json() as { message?: string; meta?: AgentMeta; error?: string };
  if (!response.ok || !payload.message || !payload.meta) {
    throw new Error(payload.error || "自由对话 Agent 调用失败");
  }
  return { message: payload.message, meta: payload.meta };
}
