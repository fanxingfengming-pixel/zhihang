import type { Provider, ProviderOverrides } from "@/lib/ai/client";

export type RuntimeAISettings = ProviderOverrides & {
  provider: Provider;
  baseUrl: string;
  model: string;
  apiKey: string;
  demoMode: boolean;
};

const globalStore = globalThis as typeof globalThis & {
  __zhihangAISettings?: Map<string, { settings: RuntimeAISettings; expiresAt: number }>;
};

const settingsStore = globalStore.__zhihangAISettings
  ?? new Map<string, { settings: RuntimeAISettings; expiresAt: number }>();
globalStore.__zhihangAISettings = settingsStore;

export function getRuntimeAISettings(sessionId?: string) {
  if (!sessionId) return undefined;
  const entry = settingsStore.get(sessionId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    settingsStore.delete(sessionId);
    return undefined;
  }
  return entry.settings;
}

export function saveRuntimeAISettings(sessionId: string, settings: RuntimeAISettings) {
  settingsStore.set(sessionId, { settings, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
}

export function clearRuntimeAISettings(sessionId?: string) {
  if (sessionId) settingsStore.delete(sessionId);
}
