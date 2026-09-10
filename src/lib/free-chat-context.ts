import type {
  CareerProfile,
  FreeChatContext,
  FreeChatContextSelection,
  FreeChatJDContext,
  FreeChatProfileContext,
  JDAnalysis,
} from "@/lib/schemas";
import type { Job } from "@/lib/ui-data";

export function buildFreeChatProfileContext(profile: CareerProfile): FreeChatProfileContext {
  return {
    targetRole: profile.basics.targetRole,
    location: profile.basics.location,
    industry: profile.basics.industry,
    careerStage: profile.basics.careerStage,
    education: {
      school: profile.basics.school,
      major: profile.basics.major,
      grade: profile.basics.grade,
    },
    skills: profile.skills,
    strengths: profile.strengths,
    projects: profile.projects,
  };
}

export function buildFreeChatJDContext(job: Job, analysis?: JDAnalysis | null): FreeChatJDContext {
  if (analysis) {
    return {
      jobTitle: analysis.jobTitle,
      company: analysis.company,
      location: job.location,
      summary: analysis.summary,
      responsibilities: analysis.responsibilities,
      requirements: [...analysis.requiredSkills, ...analysis.preferredSkills],
      keywords: analysis.keywords,
    };
  }
  return {
    jobTitle: job.role,
    company: job.company,
    location: job.location,
    summary: job.summary,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    keywords: job.tags,
  };
}

export function buildSelectedFreeChatContext(
  selections: FreeChatContextSelection[],
  profile: CareerProfile,
  job: Job,
  analysis?: JDAnalysis | null,
): FreeChatContext | undefined {
  const context: Partial<FreeChatContext> = {};
  if (selections.includes("profile")) context.profile = buildFreeChatProfileContext(profile);
  if (selections.includes("jd")) context.jd = buildFreeChatJDContext(job, analysis);
  return context.profile || context.jd ? context as FreeChatContext : undefined;
}

export function freeChatContextSelections(context?: FreeChatContext): FreeChatContextSelection[] {
  return [
    ...(context?.profile ? ["profile" as const] : []),
    ...(context?.jd ? ["jd" as const] : []),
  ];
}

export function describeFreeChatContext(context?: FreeChatContext) {
  if (!context) return [];
  const rows: string[] = [];
  if (context.profile) {
    const profile = context.profile;
    rows.push(`求职方向：${profile.targetRole || "待补充"}`);
    rows.push(`教育信息：${[profile.education.school, profile.education.major, profile.education.grade].filter(Boolean).join(" · ") || "待补充"}`);
    rows.push(`技能：${profile.skills.join("、") || "待补充"}`);
    rows.push(`项目：${profile.projects.map((project) => project.title).filter(Boolean).join("、") || "待补充"}`);
  }
  if (context.jd) {
    const jd = context.jd;
    rows.push(`当前岗位：${[jd.company, jd.jobTitle, jd.location].filter(Boolean).join(" · ")}`);
    rows.push(`岗位关键词：${jd.keywords.join("、") || "待解析"}`);
    rows.push(`岗位要求：${jd.requirements.slice(0, 6).join("；") || "待补充"}`);
  }
  return rows;
}
