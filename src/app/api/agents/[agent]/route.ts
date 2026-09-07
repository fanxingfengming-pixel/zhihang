import { generateJson, hasProviderKey, type Provider } from "@/lib/ai/client";
import { getRuntimeAISettings } from "@/lib/ai/runtime-settings";
import { prompts } from "@/lib/ai/prompts";
import { demoResult } from "@/lib/demo";
import {
  AgentRequestSchema,
  ApplicationManagementSchema,
  CareerPositioningSchema,
  CareerProfileSchema,
  GrowthPlanSchema,
  JDAnalysisSchema,
  InterviewAgentSchema,
  MatchReportSchema,
  OfferDecisionSchema,
  ResumeOptimizationInputSchema,
  ResumeOptimizationSchema,
  SkillGapAnalysisSchema,
  type CareerProfile,
  type AgentName,
  type InterviewAgentResult,
  type ResumeOptimization,
} from "@/lib/schemas";
import { ZodError } from "zod";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const outputSchemas = {
  resume: CareerProfileSchema,
  jd: JDAnalysisSchema,
  match: MatchReportSchema,
  optimize: ResumeOptimizationSchema,
  interview: InterviewAgentSchema,
  career: CareerPositioningSchema,
  gap: SkillGapAnalysisSchema,
  plan: GrowthPlanSchema,
  application: ApplicationManagementSchema,
  offer: OfferDecisionSchema,
};

function isAgentName(value: string): value is AgentName {
  return value === "resume" || value === "jd" || value === "match" || value === "optimize" || value === "interview" || value === "career" || value === "gap" || value === "plan" || value === "application" || value === "offer";
}

function parseModelJson(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as unknown;
}

function profileToMarkdown(profile: CareerProfile) {
  return `# ${profile.basics.name || "同学"}\n\n**求职方向：** ${profile.basics.targetRole || "待明确"}\n\n## 教育背景\n${[profile.basics.school, profile.basics.major, profile.basics.grade].filter(Boolean).join(" · ")}\n\n## 核心技能\n${profile.skills.map((skill) => `- ${skill}`).join("\n")}\n\n## 项目经历\n${profile.projects.map((project) => `### ${project.title}\n${project.details.map((detail) => `- ${detail}`).join("\n")}${project.result ? `\n- ${project.result}` : ""}`).join("\n\n")}`;
}

function numberTokens(value: string) {
  return new Set(value.match(/\d+(?:[.,]\d+)?%?/g) || []);
}

function secureOptimization(input: unknown, candidate: ResumeOptimization) {
  const source = ResumeOptimizationInputSchema.parse(input);
  const sourceText = `${JSON.stringify(source.profile)}\n${source.currentResumeText || ""}`;
  const warnings = new Set(candidate.factWarnings);

  for (const change of candidate.changes) {
    if (!change.evidence.length) warnings.add(`“${change.section}”的修改没有提供来源证据。`);
    for (const evidence of change.evidence) {
      if (evidence.trim() && !sourceText.includes(evidence.trim())) warnings.add(`证据“${evidence}”未在原始档案中找到。`);
    }
  }

  const sourceNumbers = numberTokens(sourceText);
  const proposedText = [
    candidate.optimizedResumeMarkdown,
    ...candidate.optimizedProfile.projects.flatMap((project) => [...project.details, project.result]),
    ...candidate.changes.map((change) => change.after),
  ].join("\n");
  for (const token of numberTokens(proposedText)) {
    if (!sourceNumbers.has(token)) warnings.add(`优化结果新增了未经证实的数字“${token}”。`);
  }

  const projects = source.profile.projects.map((project, index) => {
    const optimized = candidate.optimizedProfile.projects[index];
    return optimized ? { ...project, details: optimized.details, result: optimized.result } : project;
  });
  const normalizedProfile: CareerProfile = {
    ...source.profile,
    projects,
    resumeMarkdown: "",
    updatedAt: new Date().toISOString(),
  };
  const optimizedResumeMarkdown = profileToMarkdown(normalizedProfile);
  normalizedProfile.resumeMarkdown = optimizedResumeMarkdown;

  return ResumeOptimizationSchema.parse({
    ...candidate,
    optimizedProfile: normalizedProfile,
    optimizedResumeMarkdown,
    factWarnings: [...warnings],
    safeToApply: warnings.size === 0,
  });
}

function secureInterview(input: unknown, candidate: InterviewAgentResult) {
  if (candidate.action !== "evaluate") return candidate;
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const answer = String(source.answer || "").trim();
  const answerNumbers = numberTokens(answer);
  const containsUnsupportedNumber = (value: string) => [...numberTokens(value)].some((token) => !answerNumbers.has(token));
  const evidenceFound = candidate.evaluation.evidenceFound.filter((evidence) => evidence.trim() && answer.includes(evidence.trim()));
  const strengths = candidate.evaluation.strengths.filter((item) => !containsUnsupportedNumber(item));
  const improvements = candidate.evaluation.improvements.filter((item) => !containsUnsupportedNumber(item));
  const betterAnswer = answer
    ? `请按“背景—任务—个人行动—结果—复盘”重组原回答，并只补充能够核实的信息。原回答：${answer}\n\n待补充：真实结果或反馈（如暂无数据，请直接说明）；本次经历的复盘与下一步。`
    : "请先输入真实回答，再按“背景—任务—个人行动—结果—复盘”组织；缺失信息请标记待补充，不要编造。";
  const followUpQuestion = answer.includes("可运行版本")
    ? "你提到“完成了可运行版本”，它具体是什么交付形态？目前有哪些已经确认的真实反馈或结果？"
    : "你刚才回答中的哪一项个人行动最关键？它产生了什么可以核实的结果或反馈？";

  return InterviewAgentSchema.parse({
    ...candidate,
    evaluation: {
      ...candidate.evaluation,
      score: Math.round(candidate.evaluation.score),
      summary: containsUnsupportedNumber(candidate.evaluation.summary) ? "回答已完成结构化分析，请重点查看已有证据与下一步改进项。" : candidate.evaluation.summary,
      strengths: strengths.length ? strengths : ["回答已经正面回应问题，下一步可继续强化个人行动与真实结果。"],
      improvements: improvements.length ? improvements : ["请补充能够核实的个人行动、结果或反馈，不确定的数据不要写入回答。"],
      evidenceFound,
      betterAnswer,
      followUpQuestion,
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ agent: string }> }) {
  try {
    const { agent } = await params;
    if (!isAgentName(agent)) return Response.json({ error: "未知 Agent" }, { status: 404 });

    const body = AgentRequestSchema.parse(await request.json());
    const sessionId = (await cookies()).get("zhihang_ai_session")?.value;
    const runtimeSettings = getRuntimeAISettings(sessionId);
    const provider = (runtimeSettings?.provider || body.provider || process.env.AI_PROVIDER || "deepseek") as Provider;
    if (provider !== "deepseek" && provider !== "qwen") {
      return Response.json({ error: "AI_PROVIDER 仅支持 deepseek 或 qwen" }, { status: 400 });
    }

    const useDemo = runtimeSettings
      ? runtimeSettings.demoMode || !hasProviderKey(provider, runtimeSettings)
      : process.env.DEMO_MODE === "true" || !hasProviderKey(provider);
    const result = useDemo
      ? demoResult(agent, body.input, body.context)
      : parseModelJson(await generateJson(provider, prompts[agent], JSON.stringify({ input: body.input, context: body.context }), runtimeSettings));

    const parsed = outputSchemas[agent].parse(result);
    const validated = agent === "optimize"
      ? secureOptimization(body.input, parsed as ResumeOptimization)
      : agent === "interview"
        ? secureInterview(body.input, parsed as InterviewAgentResult)
        : parsed;
    return Response.json({ data: validated, meta: { provider: useDemo ? "demo" : provider, demo: useDemo } });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "请求或模型输出格式不符合要求", details: error.issues }, { status: 422 });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "模型返回的不是合法 JSON，请重试" }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "服务器发生未知错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
