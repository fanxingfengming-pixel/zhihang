import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { clearRuntimeAISettings, getRuntimeAISettings, saveRuntimeAISettings } from "@/lib/ai/runtime-settings";

export const runtime = "nodejs";

const SettingsSchema = z.object({
  provider: z.enum(["deepseek", "qwen"]),
  baseUrl: z.string().url("请输入完整的接口地址"),
  model: z.string().trim().min(1, "请输入模型名称").max(100),
  apiKey: z.string().trim().max(500).optional(),
  demoMode: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const input = SettingsSchema.parse(await request.json());
    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get("zhihang_ai_session")?.value;
    const sessionId = currentSessionId || randomUUID();
    const current = getRuntimeAISettings(currentSessionId);
    saveRuntimeAISettings(sessionId, {
      ...input,
      apiKey: input.apiKey || current?.apiKey || "",
    });
    cookieStore.set("zhihang_ai_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return Response.json({ ok: true, hasApiKey: Boolean(input.apiKey || current?.apiKey) });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "设置格式不正确" }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("zhihang_ai_session")?.value;
  clearRuntimeAISettings(sessionId);
  cookieStore.delete("zhihang_ai_session");
  return Response.json({ ok: true });
}
