import { afterEach, describe, expect, it } from "vitest";
import {
  getRuntimeAISettings,
  resetRuntimeAISettingsForTests,
  runtimeAISettingsCountForTests,
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

afterEach(() => resetRuntimeAISettingsForTests());

describe("runtime AI settings", () => {
  it("keeps the process-local secret store bounded", () => {
    for (let index = 0; index < 1_001; index += 1) {
      saveRuntimeAISettings(`session-${index}`, settings);
    }
    expect(runtimeAISettingsCountForTests()).toBe(1_000);
    expect(getRuntimeAISettings("session-0")).toBeUndefined();
    expect(getRuntimeAISettings("session-1000")).toEqual(settings);
  });
});
