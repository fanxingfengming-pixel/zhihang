import { describe, expect, it } from "vitest";
import { secureAgentResult } from "@/lib/agent-guards";
import { AGENT_NAMES, AGENT_OUTPUT_SCHEMAS } from "@/lib/agent-registry";
import { generateJson, hasProviderKey, type Provider } from "@/lib/ai/client";
import { buildAgentUserMessage, prompts } from "@/lib/ai/prompts";
import { looksLikePromptLeakage } from "@/lib/request-security";
import { AGENT_EVAL_CASES } from "./fixtures/agent-evals";

const enabled = process.env.RUN_LIVE_MODEL_EVALS === "true";
const provider = (process.env.LIVE_AI_PROVIDER || process.env.AI_PROVIDER || "qwen") as Provider;
const cases = AGENT_NAMES.map((agent) => AGENT_EVAL_CASES.find((item) => item.agent === agent && item.split === "baseline")!);

function parseModelJson(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as unknown;
}

describe.skipIf(!enabled)("10 Agent 真实模型冒烟评测（会产生 API 用量）", () => {
  it("has an explicitly configured supported provider", () => {
    expect(["deepseek", "qwen"]).toContain(provider);
    expect(hasProviderKey(provider), `请先配置 ${provider === "qwen" ? "QWEN" : "DEEPSEEK"}_API_KEY`).toBe(true);
  });

  it.each(cases)("$agent · $scenario", async (testCase) => {
    const raw = await generateJson(
      provider,
      prompts[testCase.agent],
      buildAgentUserMessage(testCase.input, testCase.context),
    );
    expect(looksLikePromptLeakage(raw)).toBe(false);
    const parsed = AGENT_OUTPUT_SCHEMAS[testCase.agent].parse(parseModelJson(raw));
    const secured = secureAgentResult(testCase.agent, testCase.input, testCase.context, parsed);
    expect(() => AGENT_OUTPUT_SCHEMAS[testCase.agent].parse(secured)).not.toThrow();
  }, 90_000);
});
