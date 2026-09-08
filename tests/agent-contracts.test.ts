import { describe, expect, it } from "vitest";
import { demoResult } from "@/lib/demo";
import {
  ApplicationManagementSchema,
  CareerPositioningSchema,
  CareerProfileSchema,
  GrowthPlanSchema,
  InterviewAgentSchema,
  JDAnalysisSchema,
  MatchReportSchema,
  OfferDecisionSchema,
  ResumeOptimizationSchema,
  SkillGapAnalysisSchema,
  type CareerProfile,
  type JDAnalysis,
  type MatchReport,
} from "@/lib/schemas";

const profile: CareerProfile = {
  basics: { name: "李明", school: "示例大学", major: "工业设计", grade: "2027 届", targetRole: "AI 产品实习生", location: "杭州" },
  skills: ["Figma", "数据分析"],
  strengths: ["用户研究"],
  projects: [{ title: "校园求职助手", organization: "校内项目", period: "2026", role: "产品设计", details: ["完成学生访谈和原型设计"], result: "交付可运行版本" }],
  resumeMarkdown: "",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const jd: JDAnalysis = {
  jobTitle: "AI 产品实习生", company: "示例公司", summary: "参与产品工作", responsibilities: ["需求分析"], requiredSkills: ["Figma", "SQL"], preferredSkills: ["数据分析"], keywords: ["Figma", "SQL"], experienceLevel: "实习", education: "本科",
};

const match: MatchReport = {
  score: 70, dimensions: { skills: 70, projects: 70, education: 70, experience: 70 }, verdict: "可继续准备", matchedSkills: ["Figma"], gaps: ["SQL"], evidence: ["Figma"], actionPlan: ["完成作品"], resumeTips: ["突出项目"],
};

describe("10 个 Agent 的演示输出契约", () => {
  it("全部通过对应 Zod Schema", () => {
    CareerProfileSchema.parse(demoResult("resume", { name: "李明", school: "示例大学", major: "工业设计", grade: "2027 届", targetRole: "AI 产品实习生", skills: "Figma", experience: "完成原型", projectName: "校园求职助手" }, {}));
    JDAnalysisSchema.parse(demoResult("jd", "公司：示例公司\n岗位：AI 产品实习生\n要求：Figma、SQL", {}));
    MatchReportSchema.parse(demoResult("match", {}, { profile, jd }));
    ResumeOptimizationSchema.parse(demoResult("optimize", { profile }, { jd, match }));
    InterviewAgentSchema.parse(demoResult("interview", { action: "prepare" }, { profile, jd, match }));
    InterviewAgentSchema.parse(demoResult("interview", { action: "evaluate", answer: "我负责完成原型并交付可运行版本。" }, { profile, jd, match }));
    const career = CareerPositioningSchema.parse(demoResult("career", { profile }, {}));
    const gap = SkillGapAnalysisSchema.parse(demoResult("gap", { profile }, { career }));
    GrowthPlanSchema.parse(demoResult("plan", { profile }, { career, gap }));
    ApplicationManagementSchema.parse(demoResult("application", { applications: [{ id: "a1", company: "示例公司", role: "实习生", jobId: "", stage: "applied", nextAction: "准备面试", deadline: "", notes: "", updatedAt: "2026-09-07" }] }, { profile }));
    OfferDecisionSchema.parse(demoResult("offer", { offers: [{ id: "o1", company: "A", role: "实习生", location: "杭州", monthlySalary: 8000, salaryMonths: 12, bonus: 0, growth: "", workLife: "", notes: "" }, { id: "o2", company: "B", role: "实习生", location: "上海", monthlySalary: 7000, salaryMonths: 13, bonus: 0, growth: "", workLife: "", notes: "" }] }, { profile }));
  });

  it("兼容 Qwen 将简历修改前后内容返回为字符串数组", () => {
    const candidate = demoResult("optimize", { profile }, { jd, match }) as Record<string, unknown>;
    const changes = candidate.changes as Array<Record<string, unknown>>;
    changes[0] = { ...changes[0], before: ["完成学生访谈", "完成原型设计"], after: ["完成学生访谈", "交付原型设计"] };

    const parsed = ResumeOptimizationSchema.parse(candidate);

    expect(parsed.changes[0].before).toBe("完成学生访谈\n完成原型设计");
    expect(parsed.changes[0].after).toBe("完成学生访谈\n交付原型设计");
  });
});
