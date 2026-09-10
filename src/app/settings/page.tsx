import { cookies } from "next/headers";
import { SettingsPanel, type AISettingsView } from "@/components/settings-panel";
import { CloudSyncPanel } from "@/components/cloud-sync-panel";
import { DataManagementPanel } from "@/components/data-management-panel";
import { AppShell, PageHeading } from "@/components/ui/app-shell";
import { getRuntimeAISettings, runtimeApiKeysAllowed } from "@/lib/ai/runtime-settings";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEFAULT_PROVIDER, type Provider } from "@/lib/ai/client";

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
  const environmentProvider = process.env.AI_PROVIDER === "deepseek" ? "deepseek" : DEFAULT_PROVIDER;
  const provider = runtimeSettings?.provider || environmentProvider;
  const defaults = environmentDefaults(provider);
  const environment = environmentDefaults(environmentProvider);
  const allowRuntimeApiKeys = runtimeApiKeysAllowed();
  const initial: AISettingsView = {
    provider,
    baseUrl: runtimeSettings?.baseUrl || defaults.baseUrl,
    model: runtimeSettings?.model || defaults.model,
    demoMode: runtimeSettings?.demoMode ?? process.env.DEMO_MODE === "true",
    hasApiKey: Boolean((allowRuntimeApiKeys && runtimeSettings?.apiKey) || defaults.hasApiKey),
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
      <SettingsPanel initial={initial} fallback={fallback} allowRuntimeApiKeys={allowRuntimeApiKeys} />
      <CloudSyncPanel
        configured={isSupabaseConfigured()}
        captchaSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ""}
      />
      <DataManagementPanel />
    </AppShell>
  );
}
