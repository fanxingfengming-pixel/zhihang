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

export async function sendOperationalAlert(event: {
  type: "ai_budget_warning" | "healthcheck_failure";
  requestId?: string;
  warning?: string;
  service?: string;
}) {
  const record = { event: "operational_alert", timestamp: new Date().toISOString(), ...event };
  console.warn(JSON.stringify(record));
  const webhook = process.env.AI_ALERT_WEBHOOK_URL?.trim();
  if (!webhook) return;
  try {
    const url = new URL(webhook);
    if (url.protocol !== "https:") throw new Error("告警地址必须使用 HTTPS");
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operational_alert_delivery_failed",
      timestamp: new Date().toISOString(),
      errorType: error instanceof Error ? error.name : "UnknownError",
    }));
  }
}
