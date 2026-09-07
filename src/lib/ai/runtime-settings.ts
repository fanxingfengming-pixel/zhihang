import type { Provider, ProviderOverrides } from "@/lib/ai/client";

export type RuntimeAISettings = ProviderOverrides & {
  provider: Provider;
  baseUrl: string;
  model: string;
  apiKey: string;
  demoMode: boolean;
};

const globalStore = globalThis as typeof globalThis & {
  __zhihangAISettings?: Map<string, RuntimeAISettings>;
};

const settingsStore = globalStore.__zhihangAISettings ?? new Map<string, RuntimeAISettings>();
globalStore.__zhihangAISettings = settingsStore;

export function getRuntimeAISettings(sessionId?: string) {
  return sessionId ? settingsStore.get(sessionId) : undefined;
}

export function saveRuntimeAISettings(sessionId: string, settings: RuntimeAISettings) {
  settingsStore.set(sessionId, settings);
}

export function clearRuntimeAISettings(sessionId?: string) {
  if (sessionId) settingsStore.delete(sessionId);
}
