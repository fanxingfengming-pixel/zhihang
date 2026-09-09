export type Provider = "deepseek" | "qwen";
export const DEFAULT_PROVIDER: Provider = "qwen";

export type ProviderOverrides = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_MODELS: Record<Provider, string> = {
  deepseek: "deepseek-v4-flash",
  qwen: "qwen-plus",
};

function configuredModel(provider: Provider) {
  return provider === "qwen"
    ? process.env.QWEN_MODEL || DEFAULT_MODELS.qwen
    : process.env.DEEPSEEK_MODEL || DEFAULT_MODELS.deepseek;
}

export function allowedSharedModels(provider: Provider) {
  const configured = provider === "qwen"
    ? process.env.QWEN_SHARED_MODELS
    : process.env.DEEPSEEK_SHARED_MODELS;
  const models = configured?.split(",").map((model) => model.trim()).filter(Boolean);
  return new Set(models?.length ? models : [configuredModel(provider)]);
}

export function isAllowedSharedModel(provider: Provider, model: string) {
  return allowedSharedModels(provider).has(model.trim());
}

type CompletionPayload = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function providerConfig(provider: Provider, overrides?: ProviderOverrides) {
  if (provider === "qwen") {
    return {
      apiKey: overrides?.apiKey || process.env.QWEN_API_KEY,
      baseUrl: overrides?.baseUrl || process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: overrides?.model || configuredModel("qwen"),
    };
  }

  return {
    apiKey: overrides?.apiKey || process.env.DEEPSEEK_API_KEY,
    baseUrl: overrides?.baseUrl || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: overrides?.model || configuredModel("deepseek"),
  };
}

export function hasProviderKey(provider: Provider, overrides?: ProviderOverrides) {
  return Boolean(providerConfig(provider, overrides).apiKey);
}

export function isAllowedProviderBaseUrl(provider: Provider, value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (provider === "deepseek") return url.hostname === "api.deepseek.com";
    return /^dashscope(?:-[a-z0-9-]+)?\.aliyuncs\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export async function generateJsonWithMetrics(provider: Provider, system: string, user: string, overrides?: ProviderOverrides) {
  const config = providerConfig(provider, overrides);
  if (!config.apiKey) throw new Error(`尚未配置 ${provider === "qwen" ? "QWEN" : "DEEPSEEK"}_API_KEY`);

  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const providerOptions = provider === "deepseek" ? { thinking: { type: "disabled" } } : {};
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2500,
      stream: false,
      ...providerOptions,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const payload = (await response.json()) as CompletionPayload;
  if (!response.ok) throw new Error(payload.error?.message || `模型请求失败（HTTP ${response.status}）`);

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("模型没有返回可解析的内容");
  return { content, usage: payload.usage };
}

export async function generateJson(provider: Provider, system: string, user: string, overrides?: ProviderOverrides) {
  return (await generateJsonWithMetrics(provider, system, user, overrides)).content;
}

export async function generateTextWithMetrics(
  provider: Provider,
  system: string,
  messages: ChatMessage[],
  overrides?: ProviderOverrides,
) {
  const config = providerConfig(provider, overrides);
  if (!config.apiKey) throw new Error(`尚未配置 ${provider === "qwen" ? "QWEN" : "DEEPSEEK"}_API_KEY`);

  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const providerOptions = provider === "deepseek" ? { thinking: { type: "disabled" } } : {};
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.35,
      max_tokens: 900,
      stream: false,
      ...providerOptions,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const payload = (await response.json()) as CompletionPayload;
  if (!response.ok) throw new Error(payload.error?.message || `模型请求失败（HTTP ${response.status}）`);

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("模型没有返回可用内容");
  return { content, usage: payload.usage };
}

export async function testProviderConnection(provider: Provider, overrides?: ProviderOverrides) {
  const config = providerConfig(provider, overrides);
  if (!config.apiKey) throw new Error("尚未填写接口密钥");

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: "请只回复：连接成功" }],
      temperature: 0,
      max_tokens: 8,
      stream: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as CompletionPayload | null;
    throw new Error(payload?.error?.message || `连接失败（HTTP ${response.status}）`);
  }
}
