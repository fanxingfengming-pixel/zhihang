import { z } from "zod";
import {
  ApplicationManagementSchema,
  CareerPositioningSchema,
  CareerProfileSchema,
  InterviewAgentSchema,
  MatchReportSchema,
  OfferCandidateSchema,
  OfferDecisionSchema,
  ResumeOptimizationInputSchema,
  ResumeOptimizationSchema,
  SkillGapAnalysisSchema,
  type AgentName,
  type CareerProfile,
  type InterviewAgentResult,
  type ResumeOptimization,
} from "@/lib/schemas";

export function numberTokens(value: string) {
  return new Set(value.match(/\d+(?:[.,]\d+)?%?/g) || []);
}

function containsUnsupportedNumber(value: string, sourceNumbers: Set<string>) {
  return [...numberTokens(value)].some((token) => !sourceNumbers.has(token));
}

function sourceContains(source: string, phrase: string) {
  return phrase.trim().length > 0 && source.toLowerCase().includes(phrase.trim().toLowerCase());
}

export function isClaimGrounded(source: string, claim: string) {
  const normalizedSource = source.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const normalizedClaim = claim.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (!normalizedClaim) return true;
  if (normalizedSource.includes(normalizedClaim)) return true;
  if (normalizedClaim.length < 4) return false;

  const grams = new Set<string>();
  for (let index = 0; index < normalizedClaim.length - 1; index += 1) {
    grams.add(normalizedClaim.slice(index, index + 2));
  }
  let matches = 0;
  for (const gram of grams) {
    if (normalizedSource.includes(gram)) matches += 1;
  }
  return matches >= 2 && matches / grams.size >= 0.35;
}

function profileToMarkdown(profile: CareerProfile) {
  return `# ${profile.basics.name || "同学"}\n\n**求职方向：** ${profile.basics.targetRole || "待明确"}\n\n## 教育背景\n${[profile.basics.school, profile.basics.major, profile.basics.grade].filter(Boolean).join(" · ")}\n\n## 核心技能\n${profile.skills.map((skill) => `- ${skill}`).join("\n")}\n\n## 项目经历\n${profile.projects.map((project) => `### ${project.title}\n${project.details.map((detail) => `- ${detail}`).join("\n")}${project.result ? `\n- ${project.result}` : ""}`).join("\n\n")}`;
}

export function secureResume(input: unknown, candidateInput: unknown) {
  const candidate = CareerProfileSchema.parse(candidateInput);
  const sourceText = JSON.stringify(input || {});
  const sourceNumbers = numberTokens(sourceText);
  const safeBasics = Object.fromEntries(Object.entries(candidate.basics).map(([key, value]) => [key, sourceContains(sourceText, value) ? value : ""])) as CareerProfile["basics"];
  const skills = candidate.skills.filter((skill) => sourceContains(sourceText, skill));
  const projects = candidate.projects.map((project) => ({
    ...project,
    title: sourceContains(sourceText, project.title) ? project.title : "项目经历待确认",
    organization: sourceContains(sourceText, project.organization) ? project.organization : "",
    period: sourceContains(sourceText, project.period) ? project.period : "",
    role: sourceContains(sourceText, project.role) ? project.role : "",
    details: project.details.filter((detail) => isClaimGrounded(sourceText, detail) && !containsUnsupportedNumber(detail, sourceNumbers)),
    result: isClaimGrounded(sourceText, project.result) && !containsUnsupportedNumber(project.result, sourceNumbers) ? project.result : "",
  }));
  const normalized: CareerProfile = {
    basics: safeBasics,
    skills,
    strengths: skills.slice(0, 3).map((skill) => `${skill}（来源于用户材料）`),
    projects,
    resumeMarkdown: "",
    updatedAt: new Date().toISOString(),
  };
  normalized.resumeMarkdown = profileToMarkdown(normalized);
  return CareerProfileSchema.parse(normalized);
}

export function secureOptimization(input: unknown, candidate: ResumeOptimization) {
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
  const proposedText = [candidate.optimizedResumeMarkdown, ...candidate.optimizedProfile.projects.flatMap((project) => [...project.details, project.result]), ...candidate.changes.map((change) => change.after)].join("\n");
  for (const token of numberTokens(proposedText)) if (!sourceNumbers.has(token)) warnings.add(`优化结果新增了未经证实的数字“${token}”。`);
  for (const claim of candidate.optimizedProfile.projects.flatMap((project) => [...project.details, project.result]).filter(Boolean)) {
    if (!isClaimGrounded(sourceText, claim)) warnings.add(`优化结果包含缺少原始材料支撑的表述“${claim}”。`);
  }
  for (const change of candidate.changes) {
    if (change.after.trim() && !isClaimGrounded(sourceText, change.after)) warnings.add(`“${change.section}”的改写超出了原始材料证据。`);
  }

  const projects = source.profile.projects.map((project, index) => {
    const optimized = candidate.optimizedProfile.projects[index];
    return optimized ? { ...project, details: optimized.details, result: optimized.result } : project;
  });
  const normalizedProfile: CareerProfile = { ...source.profile, projects, resumeMarkdown: "", updatedAt: new Date().toISOString() };
  const optimizedResumeMarkdown = profileToMarkdown(normalizedProfile);
  normalizedProfile.resumeMarkdown = optimizedResumeMarkdown;

  return ResumeOptimizationSchema.parse({ ...candidate, optimizedProfile: normalizedProfile, optimizedResumeMarkdown, factWarnings: [...warnings], safeToApply: warnings.size === 0 });
}

export function secureInterview(input: unknown, candidate: InterviewAgentResult) {
  if (candidate.action !== "evaluate") return candidate;
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const answer = String(source.answer || "").trim();
  const sourceNumbers = numberTokens(answer);
  const evidenceFound = candidate.evaluation.evidenceFound.filter((evidence) => evidence.trim() && answer.includes(evidence.trim()));
  const strengths = candidate.evaluation.strengths.filter((item) => !containsUnsupportedNumber(item, sourceNumbers));
  const improvements = candidate.evaluation.improvements.filter((item) => !containsUnsupportedNumber(item, sourceNumbers));
  const betterAnswer = answer ? `请按“背景—任务—个人行动—结果—复盘”重组原回答，并只补充能够核实的信息。原回答：${answer}\n\n待补充：真实结果或反馈（如暂无数据，请直接说明）；本次经历的复盘与下一步。` : "请先输入真实回答，再按“背景—任务—个人行动—结果—复盘”组织；缺失信息请标记待补充，不要编造。";
  const followUpQuestion = answer.includes("可运行版本") ? "你提到“完成了可运行版本”，它具体是什么交付形态？目前有哪些已经确认的真实反馈或结果？" : "你刚才回答中的哪一项个人行动最关键？它产生了什么可以核实的结果或反馈？";
  return InterviewAgentSchema.parse({ ...candidate, evaluation: { ...candidate.evaluation, score: Math.round(candidate.evaluation.score), summary: containsUnsupportedNumber(candidate.evaluation.summary, sourceNumbers) ? "回答已完成结构化分析，请重点查看已有证据与下一步改进项。" : candidate.evaluation.summary, strengths: strengths.length ? strengths : ["回答已经正面回应问题，下一步可继续强化个人行动与真实结果。"], improvements: improvements.length ? improvements : ["请补充能够核实的个人行动、结果或反馈，不确定的数据不要写入回答。"], evidenceFound, betterAnswer, followUpQuestion } });
}

function secureMatch(context: unknown, candidateInput: unknown) {
  const candidate = MatchReportSchema.parse(candidateInput);
  const source = context && typeof context === "object" ? context as Record<string, unknown> : {};
  const sourceText = JSON.stringify(source);
  const profile = source.profile && typeof source.profile === "object" ? source.profile as CareerProfile : null;
  const knownPhrases = profile ? [...profile.skills, ...profile.projects.flatMap((project) => [project.title, ...project.details, project.result])].filter(Boolean) : [];
  return MatchReportSchema.parse({
    ...candidate,
    score: Math.round(candidate.score),
    matchedSkills: candidate.matchedSkills.filter((skill) => sourceContains(sourceText, skill)),
    evidence: candidate.evidence.filter((evidence) => knownPhrases.some((phrase) => evidence.includes(phrase) || phrase.includes(evidence))),
  });
}

function secureCareer(input: unknown, candidateInput: unknown) {
  const candidate = CareerPositioningSchema.parse(candidateInput);
  const sourceText = JSON.stringify(input || {});
  return CareerPositioningSchema.parse({ ...candidate, recommendedRoles: candidate.recommendedRoles.map((role) => ({ ...role, fitScore: Math.round(role.fitScore), evidence: role.evidence.filter((evidence) => sourceContains(sourceText, evidence)) })) });
}

function secureGap(input: unknown, candidateInput: unknown) {
  const candidate = SkillGapAnalysisSchema.parse(candidateInput);
  const sourceText = JSON.stringify(input || {});
  return SkillGapAnalysisSchema.parse({
    ...candidate,
    readinessScore: Math.round(candidate.readinessScore),
    strengths: candidate.strengths.map((strength) => ({ ...strength, evidence: strength.evidence.filter((evidence) => sourceContains(sourceText, evidence)) })),
    gaps: candidate.gaps.map((gap) => ({ ...gap, currentEvidence: gap.currentEvidence.filter((evidence) => sourceContains(sourceText, evidence)) })),
  });
}

function secureApplication(input: unknown, candidateInput: unknown) {
  const candidate = ApplicationManagementSchema.parse(candidateInput);
  const data = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const ids = new Set(Array.isArray(data.applications) ? data.applications.map((item) => item && typeof item === "object" ? String((item as Record<string, unknown>).id || "") : "") : []);
  return ApplicationManagementSchema.parse({ ...candidate, pipelineHealth: Math.round(candidate.pipelineHealth), priorities: candidate.priorities.filter((priority) => ids.has(priority.applicationId)) });
}

function secureOffer(input: unknown, candidateInput: unknown) {
  const candidate = OfferDecisionSchema.parse(candidateInput);
  const data = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const offers = z.array(OfferCandidateSchema).catch([]).parse(data.offers);
  const ids = new Set(offers.map((offer) => offer.id));
  const offerById = new Map(offers.map((offer) => [offer.id, offer]));
  const sourceNumbers = numberTokens(JSON.stringify(offers));
  const safeList = (items: string[]) => items.filter((item) => !containsUnsupportedNumber(item, sourceNumbers));
  const recommendation = containsUnsupportedNumber(candidate.recommendation, sourceNumbers) ? "请根据已填写信息比较各方案，并先核实缺失条款后再决定。" : candidate.recommendation;
  const seen = new Set<string>();
  const ranking = candidate.ranking.filter((rank) => ids.has(rank.offerId) && !seen.has(rank.offerId)).map((rank) => {
    seen.add(rank.offerId);
    const offer = offerById.get(rank.offerId);
    const annualCash = offer ? offer.monthlySalary * offer.salaryMonths + offer.bonus : 0;
    const verifiedReasons = [
      ...(annualCash > 0 ? [`按已填数字估算，年度现金合计约 ${annualCash.toLocaleString("zh-CN")} 元。`] : []),
      ...(offer?.growth ? [`已填成长信息：${offer.growth}`] : []),
      ...safeList(rank.reasons).filter((reason) => !/薪|现金|奖金|收入/.test(reason)),
    ];
    return { ...rank, score: Math.round(rank.score), reasons: verifiedReasons, risks: safeList(rank.risks) };
  });
  return OfferDecisionSchema.parse({ ...candidate, ranking, recommendation, tradeoffs: safeList(candidate.tradeoffs), questionsToVerify: safeList(candidate.questionsToVerify), negotiationPoints: safeList(candidate.negotiationPoints) });
}

export function secureAgentResult(agent: AgentName, input: unknown, context: unknown, parsed: unknown) {
  switch (agent) {
    case "resume": return secureResume(input, parsed);
    case "match": return secureMatch(context, parsed);
    case "optimize": return secureOptimization(input, ResumeOptimizationSchema.parse(parsed));
    case "interview": return secureInterview(input, InterviewAgentSchema.parse(parsed));
    case "career": return secureCareer(input, parsed);
    case "gap": return secureGap(input, parsed);
    case "application": return secureApplication(input, parsed);
    case "offer": return secureOffer(input, parsed);
    default: return parsed;
  }
}
