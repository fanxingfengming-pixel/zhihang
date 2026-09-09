import { cookies } from "next/headers";
import { assertSharedAIKeyAccess } from "@/lib/ai/access-control";
import { isAllowedSharedModel, testProviderConnection } from "@/lib/ai/client";
import { getRuntimeAISettings, runtimeApiKeysAllowed } from "@/lib/ai/runtime-settings";
import { privateJson, protectMutation, RequestSecurityError, requestSecurityError } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    protectMutation(request, "ai-connection-test", { limit: 10 });
    const sessionId = (await cookies()).get("zhihang_ai_session")?.value;
    const savedSettings = getRuntimeAISettings(sessionId);
    if (!savedSettings) return privateJson({ error: "请先保存 API 设置" }, { status: 400 });
    const settings = {
      ...savedSettings,
      apiKey: runtimeApiKeysAllowed() ? savedSettings.apiKey : "",
    };
    if (settings.demoMode) return privateJson({ ok: true, message: "演示模式运行正常，不会产生 API 费用" });
    if (!settings.apiKey.trim()) {
      if (!isAllowedSharedModel(settings.provider, settings.model)) {
        throw new RequestSecurityError("平台共享密钥不支持该模型，请选择管理员允许的模型或填写自己的 API 密钥。", 400);
      }
      await assertSharedAIKeyAccess();
    }
    await testProviderConnection(settings.provider, settings);
    return privateJson({ ok: true, message: "接口连接成功，模型已响应" });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityError(error);
    return privateJson({ error: "连接失败，请检查官方接口地址、模型名称和密钥。" }, { status: 502 });
  }
}
