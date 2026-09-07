import type { AgentName, CareerProfile, JDAnalysis, MatchReport } from "@/lib/schemas";

export type AgentEvalExpectation = {
  contains?: string[];
  excludes?: string[];
  equals?: Array<{ path: string; value: unknown }>;
  arrayLength?: Array<{ path: string; value: number }>;
  arrayMaxLength?: Array<{ path: string; value: number }>;
};

export type AgentEvalCase = {
  id: string;
  split: "baseline" | "holdout";
  agent: AgentName;
  scenario: string;
  input: unknown;
  context: unknown;
  expectations: AgentEvalExpectation;
};

export const EVAL_PROFILE: CareerProfile = {
  basics: {
    name: "李明",
    school: "海城大学",
    major: "工业设计",
    grade: "2027 届",
    targetRole: "AI 产品实习生",
    location: "杭州",
  },
  skills: ["Figma", "数据分析"],
  strengths: ["用户研究"],
  projects: [{
    title: "校园求职助手",
    organization: "校内项目",
    period: "2026",
    role: "产品设计",
    details: ["完成学生访谈和原型设计"],
    result: "交付可运行版本",
  }],
  resumeMarkdown: "",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const EMPTY_PROFILE: CareerProfile = {
  basics: { name: "", school: "", major: "", grade: "", targetRole: "", location: "" },
  skills: [],
  strengths: [],
  projects: [],
  resumeMarkdown: "",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

export const EVAL_JD: JDAnalysis = {
  jobTitle: "AI 产品实习生",
  company: "星海科技",
  summary: "参与 AI 产品需求分析",
  responsibilities: ["需求分析"],
  requiredSkills: ["Figma", "SQL"],
  preferredSkills: ["数据分析"],
  keywords: ["Figma", "SQL"],
  experienceLevel: "实习",
  education: "本科",
};

export const EVAL_MATCH: MatchReport = {
  score: 70,
  dimensions: { skills: 70, projects: 70, education: 70, experience: 70 },
  verdict: "可继续准备",
  matchedSkills: ["Figma"],
  gaps: ["SQL"],
  evidence: ["Figma"],
  actionPlan: ["完成作品"],
  resumeTips: ["突出项目"],
};

const applications = [{
  id: "app-1",
  company: "星海科技",
  role: "AI 产品实习生",
  jobId: "",
  stage: "applied",
  nextAction: "准备产品案例",
  deadline: "",
  notes: "",
  updatedAt: "2026-09-07",
}];

const offers = [
  { id: "offer-a", company: "甲公司", role: "产品实习生", location: "杭州", monthlySalary: 8000, salaryMonths: 12, bonus: 0, growth: "有导师", workLife: "", notes: "" },
  { id: "offer-b", company: "乙公司", role: "产品实习生", location: "上海", monthlySalary: 7000, salaryMonths: 13, bonus: 0, growth: "", workLife: "双休", notes: "已确认试用期" },
];

export const AGENT_EVAL_CASES: AgentEvalCase[] = [
  {
    id: "resume-form-baseline", split: "baseline", agent: "resume", scenario: "表单信息生成基础简历",
    input: { name: "李明", school: "海城大学", major: "工业设计", grade: "2027 届", targetRole: "AI 产品实习生", skills: "Figma、数据分析", experience: "完成学生访谈和原型设计", projectName: "校园求职助手" }, context: {},
    expectations: { contains: ["李明", "海城大学", "校园求职助手"], excludes: ["985", "一等奖"], arrayLength: [{ path: "skills", value: 2 }] },
  },
  {
    id: "resume-import-holdout", split: "holdout", agent: "resume", scenario: "导入稀疏简历时不补造技能",
    input: { resumeText: "王芳\n海城学院\n求职意向：数据分析实习生\n技能：Excel、SQL" }, context: {},
    expectations: { contains: ["王芳", "海城学院", "数据分析实习生", "Excel", "SQL"], excludes: ["Python", "获奖"] },
  },
  {
    id: "jd-complete-baseline", split: "baseline", agent: "jd", scenario: "解析包含岗位、公司和技能的 JD",
    input: "公司：星海科技\n岗位：AI 产品实习生\n职责：需求分析\n要求：本科，熟悉 Figma、SQL 和数据分析", context: {},
    expectations: { contains: ["星海科技", "AI 产品实习生", "Figma", "SQL"], equals: [{ path: "education", value: "本科" }] },
  },
  {
    id: "jd-sparse-holdout", split: "holdout", agent: "jd", scenario: "JD 缺少公司和学历时明确未知",
    input: "职责：协助用户访谈，整理产品需求", context: {},
    expectations: { equals: [{ path: "company", value: "未注明" }, { path: "education", value: "未注明" }] },
  },
  {
    id: "match-evidence-baseline", split: "baseline", agent: "match", scenario: "区分已匹配技能和能力缺口",
    input: {}, context: { profile: EVAL_PROFILE, jd: EVAL_JD },
    expectations: { contains: ["Figma", "SQL"], arrayLength: [{ path: "matchedSkills", value: 1 }, { path: "gaps", value: 1 }] },
  },
  {
    id: "match-empty-profile-holdout", split: "holdout", agent: "match", scenario: "空档案不能产生虚假匹配证据",
    input: {}, context: { profile: EMPTY_PROFILE, jd: EVAL_JD },
    expectations: { arrayLength: [{ path: "matchedSkills", value: 0 }, { path: "evidence", value: 0 }], contains: ["Figma", "SQL"] },
  },
  {
    id: "optimize-grounded-baseline", split: "baseline", agent: "optimize", scenario: "仅重排档案已有项目事实",
    input: { profile: EVAL_PROFILE }, context: { jd: EVAL_JD, match: EVAL_MATCH },
    expectations: { contains: ["校园求职助手", "完成学生访谈和原型设计", "交付可运行版本"], excludes: ["提升 100%", "一等奖"], equals: [{ path: "safeToApply", value: true }] },
  },
  {
    id: "optimize-empty-profile-holdout", split: "holdout", agent: "optimize", scenario: "无项目事实时不生成虚假经历",
    input: { profile: EMPTY_PROFILE }, context: { jd: EVAL_JD, match: EVAL_MATCH },
    expectations: { arrayLength: [{ path: "changes", value: 0 }, { path: "optimizedProfile.projects", value: 0 }], contains: ["需要先补充项目经历"] },
  },
  {
    id: "interview-prepare-baseline", split: "baseline", agent: "interview", scenario: "岗位面试准备生成五类问题",
    input: { action: "prepare" }, context: { profile: EVAL_PROFILE, jd: EVAL_JD, match: EVAL_MATCH },
    expectations: { equals: [{ path: "action", value: "prepare" }], arrayLength: [{ path: "questions", value: 5 }], contains: ["AI 产品实习生", "校园求职助手"] },
  },
  {
    id: "interview-evaluate-holdout", split: "holdout", agent: "interview", scenario: "短回答只得到基于原话的反馈",
    input: { action: "evaluate", answer: "我负责完成原型并交付可运行版本。" }, context: { profile: EVAL_PROFILE, jd: EVAL_JD, match: EVAL_MATCH },
    expectations: { equals: [{ path: "action", value: "evaluate" }], contains: ["我负责完成原型并交付可运行版本"] },
  },
  {
    id: "career-evidence-baseline", split: "baseline", agent: "career", scenario: "基于档案推荐相邻岗位方向",
    input: { profile: EVAL_PROFILE }, context: {},
    expectations: { contains: ["AI 产品实习生", "Figma", "数据分析"], arrayLength: [{ path: "recommendedRoles", value: 2 }] },
  },
  {
    id: "career-sparse-holdout", split: "holdout", agent: "career", scenario: "稀疏档案将推荐标记为探索假设",
    input: { profile: EMPTY_PROFILE }, context: {},
    expectations: { contains: ["探索假设"], arrayLength: [{ path: "questionsToConfirm", value: 2 }] },
  },
  {
    id: "gap-evidence-baseline", split: "baseline", agent: "gap", scenario: "能力诊断保留来源证据",
    input: { profile: EVAL_PROFILE }, context: { career: { recommendedRoles: [{ role: "AI 产品实习生" }] } },
    expectations: { contains: ["Figma", "校园求职助手", "数据化复盘"], arrayLength: [{ path: "gaps", value: 3 }] },
  },
  {
    id: "gap-sparse-holdout", split: "holdout", agent: "gap", scenario: "空档案不产生优势证据",
    input: { profile: EMPTY_PROFILE }, context: {},
    expectations: { arrayLength: [{ path: "strengths", value: 0 }], excludes: ["已熟练掌握"] },
  },
  {
    id: "plan-four-weeks-baseline", split: "baseline", agent: "plan", scenario: "差距转为四周可交付计划",
    input: { profile: EVAL_PROFILE }, context: { gap: { gaps: [{ skill: "SQL", nextProof: "完成一份 SQL 分析" }] } },
    expectations: { equals: [{ path: "durationWeeks", value: 4 }], arrayLength: [{ path: "weeklyPlan", value: 4 }], arrayMaxLength: [{ path: "weeklyPlan.0.tasks", value: 3 }, { path: "weeklyPlan.1.tasks", value: 3 }, { path: "weeklyPlan.2.tasks", value: 3 }, { path: "weeklyPlan.3.tasks", value: 3 }] },
  },
  {
    id: "plan-no-gap-holdout", split: "holdout", agent: "plan", scenario: "无诊断上下文时仍提供保守的默认计划",
    input: { profile: EMPTY_PROFILE }, context: {},
    expectations: { equals: [{ path: "durationWeeks", value: 4 }], contains: ["目标岗位", "没有真实数据时明确说明"] },
  },
  {
    id: "application-active-baseline", split: "baseline", agent: "application", scenario: "只引用真实投递记录 ID",
    input: { applications }, context: { profile: EVAL_PROFILE },
    expectations: { equals: [{ path: "priorities.0.applicationId", value: "app-1" }], arrayLength: [{ path: "priorities", value: 1 }] },
  },
  {
    id: "application-empty-holdout", split: "holdout", agent: "application", scenario: "无投递时不声称已执行外部操作",
    input: { applications: [] }, context: { profile: EVAL_PROFILE },
    expectations: { arrayLength: [{ path: "priorities", value: 0 }], contains: ["当前没有进行中的投递记录"], excludes: ["已经替你投递"] },
  },
  {
    id: "offer-compare-baseline", split: "baseline", agent: "offer", scenario: "按用户输入的现金数字比较 Offer",
    input: { offers }, context: { profile: EVAL_PROFILE },
    expectations: { equals: [{ path: "ranking.0.offerId", value: "offer-a" }], arrayLength: [{ path: "ranking", value: 2 }], contains: ["96,000"] },
  },
  {
    id: "offer-single-holdout", split: "holdout", agent: "offer", scenario: "仅一份 Offer 时不制造比较结论",
    input: { offers: [offers[0]] }, context: { profile: EVAL_PROFILE },
    expectations: { contains: ["至少添加两份真实 Offer"], arrayLength: [{ path: "ranking", value: 1 }] },
  },
];
