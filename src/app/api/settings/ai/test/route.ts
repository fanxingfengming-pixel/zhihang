import { cookies } from "next/headers";
import { testProviderConnection } from "@/lib/ai/client";
import { getRuntimeAISettings } from "@/lib/ai/runtime-settings";
import { privateJson, protectMutation, RequestSecurityError, requestSecurityError } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    protectMutation(request, "ai-connection-test", { limit: 10 });
    const sessionId = (await cookies()).get("zhihang_ai_session")?.value;
    const settings = getRuntimeAISettings(sessionId);
    if (!settings) return privateJson({ error: "请先保存 API 设置" }, { status: 400 });
    if (settings.demoMode) return privateJson({ ok: true, message: "演示模式运行正常，不会产生 API 费用" });
    await testProviderConnection(settings.provider, settings);
    return privateJson({ ok: true, message: "接口连接成功，模型已响应" });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityError(error);
    return privateJson({ error: "连接失败，请检查官方接口地址、模型名称和密钥。" }, { status: 502 });
  }
}
