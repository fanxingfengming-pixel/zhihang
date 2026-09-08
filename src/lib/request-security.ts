const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
} as const;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const MAX_RATE_LIMIT_IDENTITIES = 10_000;

export class RequestSecurityError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "RequestSecurityError";
  }
}

export function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) headers.set(name, value);
  return Response.json(body, { ...init, headers });
}

export function requestSecurityError(error: RequestSecurityError) {
  const headers = error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined;
  return privateJson({ error: error.message }, { status: error.status, headers });
}

function requestIdentity(request: Request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("user-agent")?.slice(0, 160) || "unknown";
}

export function protectMutation(
  request: Request,
  scope: string,
  options: { limit?: number; windowMs?: number } = {},
) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    throw new RequestSecurityError("拒绝跨站请求。", 403);
  }

  const limit = options.limit ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  if (rateLimitStore.size >= MAX_RATE_LIMIT_IDENTITIES) {
    for (const [storedKey, entry] of rateLimitStore) {
      if (entry.resetAt <= now) rateLimitStore.delete(storedKey);
    }
    if (rateLimitStore.size >= MAX_RATE_LIMIT_IDENTITIES) {
      const oldestKey = rateLimitStore.keys().next().value;
      if (oldestKey) rateLimitStore.delete(oldestKey);
    }
  }
  const key = `${scope}:${requestIdentity(request)}`;
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new RequestSecurityError(
      "请求过于频繁，请稍后再试。",
      429,
      Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    );
  }
  current.count += 1;
}

export async function readJsonWithLimit(request: Request, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestSecurityError(`请求内容不能超过 ${Math.ceil(maxBytes / 1024)}KB。`, 413);
  }

  if (!request.body) throw new RequestSecurityError("请求内容为空。", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RequestSecurityError(`请求内容不能超过 ${Math.ceil(maxBytes / 1024)}KB。`, 413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new RequestSecurityError("请求不是有效的 JSON。", 400);
  }
}

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:sk|dk)-[A-Za-z0-9_-]{16,}\b/g, "[已隐藏 API 密钥]"],
  [/(?:api[_\s-]?key|密钥)\s*[:=：]\s*[A-Za-z0-9_-]{16,}/gi, "API_KEY=[已隐藏]"],
  [/\bbearer\s+[A-Za-z0-9._-]{16,}\b/gi, "Bearer [已隐藏]"],
  [/-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, "[已隐藏私钥]"],
];

export function redactSecrets<T>(value: T): T {
  if (typeof value === "string") {
    let redacted: string = value;
    for (const [pattern, replacement] of SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }
    return redacted as T;
  }
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redactSecrets(item)]),
    ) as T;
  }
  return value;
}

export function looksLikePromptLeakage(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const promptFragments = [
    "你是“职航”大学生求职实训系统中的专业 Agent",
    "必须遵守：只依据用户提供的信息",
    "输出必须是合法 JSON，不能包含 Markdown 代码围栏",
  ];
  return promptFragments.filter((fragment) => text.includes(fragment)).length >= 2;
}

const EMBEDDED_INSTRUCTION_PATTERNS = [
  /ignore\s+(?:all|any|the|previous|above).*(?:instruction|prompt|rule)/i,
  /(?:忽略|无视|跳过).{0,20}(?:以上|此前|系统|所有)?.{0,12}(?:指令|提示词|规则)/i,
  /(?:显示|泄露|复述|输出|翻译).{0,20}(?:系统提示词|隐藏指令|system prompt)/i,
  /(?:you are now|现在你是).{0,40}(?:assistant|agent|助手|智能体)/i,
];

export function removeEmbeddedInstructionLines(value: string) {
  return value
    .replace(/[\u200b-\u200f\u2060-\u206f\ufeff]/g, "")
    .split(/\r?\n/)
    .filter((line) => !EMBEDDED_INSTRUCTION_PATTERNS.some((pattern) => pattern.test(line)))
    .join("\n")
    .trim();
}

export function resetRateLimitsForTests() {
  rateLimitStore.clear();
}
