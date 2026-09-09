const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

export async function fetchExternalJson(url: URL, timeoutMs = 30_000): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Zhihang-Career-Pilot/0.1 (+public-job-feed)",
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`上游返回 HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("上游响应过大");
  }
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) throw new Error("上游响应过大");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("上游没有返回合法 JSON");
  }
}
