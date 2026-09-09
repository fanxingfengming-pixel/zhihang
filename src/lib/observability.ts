type AIRequestEvent = {
  requestId: string;
  agent: string;
  provider: string;
  model?: string;
  demo: boolean;
  status: "success" | "error";
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  errorType?: string;
};

export function logAIRequest(event: AIRequestEvent) {
  const record = {
    event: "ai_request",
    timestamp: new Date().toISOString(),
    ...event,
  };
  // Structured stdout is collected by Vercel and most Node.js hosting platforms.
  console.info(JSON.stringify(record));
}
