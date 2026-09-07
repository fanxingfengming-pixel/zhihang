import { cookies } from "next/headers";
import { SettingsPanel, type AISettingsView } from "@/components/settings-panel";
import { AppShell, PageHeading } from "@/components/ui/app-shell";
import { getRuntimeAISettings } from "@/lib/ai/runtime-settings";
import type { Provider } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

function environmentDefaults(provider: Provider) {
  if (provider === "qwen") {
    return {
      baseUrl: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: process.env.QWEN_MODEL || "qwen-plus",
      hasApiKey: Boolean(process.env.QWEN_API_KEY),
    };
  }
  return {
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    hasApiKey: Boolean(process.env.DEEPSEEK_API_KEY),
  };
}

export default async function SettingsPage() {
  const sessionId = (await cookies()).get("zhihang_ai_session")?.value;
  const runtimeSettings = getRuntimeAISettings(sessionId);
  const environmentProvider = process.env.AI_PROVIDER === "qwen" ? "qwen" : "deepseek";
  const provider = runtimeSettings?.provider || environmentProvider;
  const defaults = environmentDefaults(provider);
  const environment = environmentDefaults(environmentProvider);
  const initial: AISettingsView = {
    provider,
    baseUrl: runtimeSettings?.baseUrl || defaults.baseUrl,
    model: runtimeSettings?.model || defaults.model,
    demoMode: runtimeSettings?.demoMode ?? process.env.DEMO_MODE === "true",
    hasApiKey: Boolean(runtimeSettings?.apiKey || defaults.hasApiKey),
  };
  const fallback: AISettingsView = {
    provider: environmentProvider,
    baseUrl: environment.baseUrl,
    model: environment.model,
    demoMode: process.env.DEMO_MODE === "true",
    hasApiKey: environment.hasApiKey,
  };

  return (
    <AppShell>
      <PageHeading eyebrow="系统设置" title="设置" description="集中管理界面偏好与 AI 接口。密钥仅停留在本地服务运行会话中。" />
      <SettingsPanel initial={initial} fallback={fallback} />
    </AppShell>
  );
}
