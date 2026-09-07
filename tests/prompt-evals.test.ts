import { describe, expect, it } from "vitest";
import { AGENT_NAMES, AGENT_OUTPUT_SCHEMAS } from "@/lib/agent-registry";
import { secureAgentResult } from "@/lib/agent-guards";
import { BASE_AGENT_GUARDRAILS, PROMPT_VERSION, prompts } from "@/lib/ai/prompts";
import { demoResult } from "@/lib/demo";
import { AGENT_EVAL_CASES, type AgentEvalCase } from "./fixtures/agent-evals";

function atPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, value);
}

function evaluateExpectations(testCase: AgentEvalCase, output: unknown) {
  const failures: string[] = [];
  const serialized = JSON.stringify(output);
  const expected = testCase.expectations;

  for (const text of expected.contains || []) {
    if (!serialized.includes(text)) failures.push(`输出缺少：${text}`);
  }
  for (const text of expected.excludes || []) {
    if (serialized.includes(text)) failures.push(`输出包含不应出现的内容：${text}`);
  }
  for (const item of expected.equals || []) {
    if (!Object.is(atPath(output, item.path), item.value)) {
      failures.push(`${item.path} 不等于 ${JSON.stringify(item.value)}`);
    }
  }
  for (const item of expected.arrayLength || []) {
    const actual = atPath(output, item.path);
    if (!Array.isArray(actual) || actual.length !== item.value) {
      failures.push(`${item.path} 的长度不等于 ${item.value}`);
    }
  }
  for (const item of expected.arrayMaxLength || []) {
    const actual = atPath(output, item.path);
    if (!Array.isArray(actual) || actual.length > item.value) {
      failures.push(`${item.path} 的长度超过 ${item.value}`);
    }
  }

  return failures;
}

describe(`Prompt ${PROMPT_VERSION} 静态契约`, () => {
  it("10 个 Agent 共用一份稳定的事实与 JSON 边界", () => {
    expect(AGENT_NAMES).toHaveLength(10);
    for (const agent of AGENT_NAMES) {
      expect(prompts[agent]).toContain(BASE_AGENT_GUARDRAILS);
      expect(prompts[agent]).toContain("绝不虚构");
      expect(prompts[agent]).toContain("合法 JSON");
      expect(prompts[agent]).toContain("严格输出");
    }
  });
});

describe("10 Agent Prompt 基线与保留集", () => {
  it("每个 Agent 都有 baseline 与 holdout 案例", () => {
    for (const agent of AGENT_NAMES) {
      const cases = AGENT_EVAL_CASES.filter((item) => item.agent === agent);
      expect(cases.some((item) => item.split === "baseline"), agent).toBe(true);
      expect(cases.some((item) => item.split === "holdout"), agent).toBe(true);
    }
  });

  it.each(AGENT_EVAL_CASES)("$id · $scenario", (testCase) => {
    const raw = demoResult(testCase.agent, testCase.input, testCase.context);
    const parsed = AGENT_OUTPUT_SCHEMAS[testCase.agent].parse(raw);
    const secured = secureAgentResult(testCase.agent, testCase.input, testCase.context, parsed);
    AGENT_OUTPUT_SCHEMAS[testCase.agent].parse(secured);
    expect(evaluateExpectations(testCase, secured)).toEqual([]);
  });
});
