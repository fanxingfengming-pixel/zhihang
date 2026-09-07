import { cookies } from "next/headers";
import { testProviderConnection } from "@/lib/ai/client";
import { getRuntimeAISettings } from "@/lib/ai/runtime-settings";

export const runtime = "nodejs";

export async function POST() {
  try {
    const sessionId = (await cookies()).get("zhihang_ai_session")?.value;
    const settings = getRuntimeAISettings(sessionId);
    if (!settings) return Response.json({ error: "请先保存 API 设置" }, { status: 400 });
    if (settings.demoMode) return Response.json({ ok: true, message: "演示模式运行正常，不会产生 API 费用" });
    await testProviderConnection(settings.provider, settings);
    return Response.json({ ok: true, message: "接口连接成功，模型已响应" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "连接测试失败" }, { status: 502 });
  }
}
