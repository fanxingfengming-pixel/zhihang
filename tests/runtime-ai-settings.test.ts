import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRuntimeAISettings,
  resetRuntimeAISettingsForTests,
  runtimeAISettingsCountForTests,
  runtimeApiKeysAllowed,
  saveRuntimeAISettings,
  type RuntimeAISettings,
} from "@/lib/ai/runtime-settings";

const settings: RuntimeAISettings = {
  provider: "qwen",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "qwen-plus",
  apiKey: "test-only-key",
  demoMode: false,
};

afterEach(() => {
  resetRuntimeAISettingsForTests();
  vi.unstubAllEnvs();
});

describe("runtime AI settings", () => {
  it("keeps the process-local secret store bounded", () => {
    for (let index = 0; index < 1_001; index += 1) {
      saveRuntimeAISettings(`session-${index}`, settings);
    }
    expect(runtimeAISettingsCountForTests()).toBe(1_000);
    expect(getRuntimeAISettings("session-0")).toBeUndefined();
    expect(getRuntimeAISettings("session-1000")).toEqual(settings);
  });

  it("disables ephemeral browser-provided keys in production by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_RUNTIME_API_KEYS", "");
    expect(runtimeApiKeysAllowed()).toBe(false);
    vi.stubEnv("ALLOW_RUNTIME_API_KEYS", "true");
    expect(runtimeApiKeysAllowed()).toBe(true);
  });
});
