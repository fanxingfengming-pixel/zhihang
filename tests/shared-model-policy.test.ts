import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedSharedModels, isAllowedSharedModel } from "@/lib/ai/client";

afterEach(() => vi.unstubAllEnvs());

describe("shared model policy", () => {
  it("allows only the administrator-configured model by default", () => {
    vi.stubEnv("QWEN_MODEL", "qwen-plus");
    vi.stubEnv("QWEN_SHARED_MODELS", "");
    expect(isAllowedSharedModel("qwen", "qwen-plus")).toBe(true);
    expect(isAllowedSharedModel("qwen", "qwen-max")).toBe(false);
  });

  it("supports an explicit comma-separated allowlist", () => {
    vi.stubEnv("DEEPSEEK_SHARED_MODELS", "deepseek-chat, deepseek-reasoner");
    expect([...allowedSharedModels("deepseek")]).toEqual(["deepseek-chat", "deepseek-reasoner"]);
  });
});
