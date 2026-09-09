import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { isAllowedProviderBaseUrl, isAllowedSharedModel } from "@/lib/ai/client";
import { clearRuntimeAISettings, getRuntimeAISettings, runtimeApiKeysAllowed, saveRuntimeAISettings } from "@/lib/ai/runtime-settings";
import { privateJson, protectMutation, readJsonWithLimit, RequestSecurityError, requestSecurityError } from "@/lib/request-security";

export const runtime = "nodejs";

const SettingsSchema = z.object({
  provider: z.enum(["deepseek", "qwen"]),
  baseUrl: z.string().url("请输入完整的接口地址"),
  model: z.string().trim().min(1, "请输入模型名称").max(100),
  apiKey: z.string().trim().max(500).optional(),
  demoMode: z.boolean(),
}).superRefine((value, context) => {
  if (!isAllowedProviderBaseUrl(value.provider, value.baseUrl)) {
    context.addIssue({
      code: "custom",
      path: ["baseUrl"],
      message: value.provider === "deepseek"
        ? "DeepSeek 仅允许使用 https://api.deepseek.com"
        : "Qwen 仅允许使用阿里云 DashScope 官方 HTTPS 地址",
    });
  }
});

export async function POST(request: Request) {
  try {
    protectMutation(request, "ai-settings", { limit: 15 });
    const input = SettingsSchema.parse(await readJsonWithLimit(request, 8 * 1024));
    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get("zhihang_ai_session")?.value;
    const sessionId = currentSessionId || randomUUID();
    const current = getRuntimeAISettings(currentSessionId);
    if (input.apiKey && !runtimeApiKeysAllowed()) {
      throw new RequestSecurityError("生产环境不接受网页临时密钥，请由管理员配置服务端环境变量。", 403);
    }
    const effectiveApiKey = input.apiKey || (runtimeApiKeysAllowed() ? current?.apiKey : "") || "";
    if (!input.demoMode && !effectiveApiKey && !isAllowedSharedModel(input.provider, input.model)) {
      throw new RequestSecurityError("平台共享密钥不支持该模型，请选择管理员允许的模型。", 400);
    }
    saveRuntimeAISettings(sessionId, {
      ...input,
      apiKey: effectiveApiKey,
    });
    cookieStore.set("zhihang_ai_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return privateJson({ ok: true, hasApiKey: Boolean(effectiveApiKey) });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityError(error);
    if (error instanceof z.ZodError) return privateJson({ error: error.issues[0]?.message || "设置格式不正确" }, { status: 400 });
    return privateJson({ error: "保存失败，请稍后重试。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    protectMutation(request, "ai-settings", { limit: 15 });
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("zhihang_ai_session")?.value;
    clearRuntimeAISettings(sessionId);
    cookieStore.delete("zhihang_ai_session");
    return privateJson({ ok: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityError(error);
    return privateJson({ error: "清除设置失败，请稍后重试。" }, { status: 500 });
  }
}
