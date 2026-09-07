import { describe, expect, it } from "vitest";
import { secureAgentResult, secureInterview, secureOptimization, secureResume } from "@/lib/agent-guards";
import type { CareerProfile, InterviewAgentResult, ResumeOptimization } from "@/lib/schemas";

const profile: CareerProfile = {
  basics: { name: "李明", school: "示例大学", major: "工业设计", grade: "2027 届", targetRole: "产品实习生", location: "杭州" },
  skills: ["Figma"], strengths: [],
  projects: [{ title: "校园助手", organization: "校内", period: "2026", role: "成员", details: ["完成原型"], result: "交付版本" }],
  resumeMarkdown: "", updatedAt: "2026-09-07T00:00:00.000Z",
};

describe("统一事实防护", () => {
  it("简历导入删除原材料中不存在的技能和新增数字", () => {
    const secured = secureResume({ resumeText: "李明\n示例大学\nFigma\n校园助手\n完成原型" }, {
      ...profile,
      skills: ["Figma", "SQL"],
      projects: [{ ...profile.projects[0], details: ["完成原型", "使效率提升 80%"] }],
    });
    expect(secured.skills).toEqual(["Figma"]);
    expect(secured.projects[0].details).toEqual(["完成原型"]);
  });

  it("面试参考回答只保留用户原话并移除伪造证据", () => {
    const candidate: InterviewAgentResult = { action: "evaluate", evaluation: { score: 82, summary: "效果提升 60%", strengths: ["完成了 12 次测试"], improvements: ["补充结果"], evidenceFound: ["完成原型", "不存在的证据"], betterAnswer: "编造后的答案", followUpQuestion: "虚构追问" } };
    const secured = secureInterview({ action: "evaluate", answer: "我完成原型并交付可运行版本" }, candidate);
    expect(secured.action).toBe("evaluate");
    if (secured.action === "evaluate") {
      expect(secured.evaluation.betterAnswer).toContain("我完成原型并交付可运行版本");
      expect(secured.evaluation.betterAnswer).not.toContain("60%");
      expect(secured.evaluation.evidenceFound).toEqual(["完成原型"]);
      expect(secured.evaluation.followUpQuestion).toContain("可运行版本");
    }
  });

  it("简历优化出现新数字时禁止直接应用", () => {
    const candidate: ResumeOptimization = { optimizedProfile: { ...profile, projects: [{ ...profile.projects[0], result: "效率提升 90%" }] }, optimizedResumeMarkdown: "效率提升 90%", headline: "优化", summary: "", changes: [{ section: "项目", before: "完成原型", after: "效率提升 90%", reason: "更具体", evidence: ["完成原型"] }], usedKeywords: [], unresolvedGaps: [], factWarnings: [], safeToApply: true };
    const secured = secureOptimization({ profile, currentResumeText: "完成原型" }, candidate);
    expect(secured.safeToApply).toBe(false);
    expect(secured.factWarnings.join(" ")).toContain("90%");
  });

  it("投递 Agent 不能引用不存在的记录 ID", () => {
    const result = secureAgentResult("application", { applications: [{ id: "real-id" }] }, {}, { summary: "", pipelineHealth: 70, priorities: [{ applicationId: "fake-id", action: "发送邮件", reason: "", urgency: "today" }], followUps: [], risks: [] }) as { priorities: unknown[] };
    expect(result.priorities).toHaveLength(0);
  });

  it("Offer Agent 删除不存在的 Offer 与输入外数字", () => {
    const offers = [{ id: "o1", company: "A", role: "实习生", location: "杭州", monthlySalary: 8000, salaryMonths: 12, bonus: 0, growth: "", workLife: "", notes: "" }];
    const result = secureAgentResult("offer", { offers }, {}, { ranking: [{ offerId: "o1", score: 80, reasons: ["年薪 300000 元"], risks: [] }, { offerId: "fake", score: 99, reasons: [], risks: [] }], recommendation: "年薪 300000 元最高", tradeoffs: [], questionsToVerify: [], negotiationPoints: [], disclaimer: "仅供参考" }) as { ranking: Array<{ offerId: string; reasons: string[] }>; recommendation: string };
    expect(result.ranking.map((item) => item.offerId)).toEqual(["o1"]);
    expect(result.ranking[0].reasons.join(" ")).toContain("96,000");
    expect(result.ranking[0].reasons.join(" ")).not.toContain("300000");
    expect(result.recommendation).not.toContain("300000");
  });
});
