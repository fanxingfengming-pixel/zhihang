import { runAgent, type AgentMeta } from "@/lib/agent-client";
import { JDAnalysisSchema, MatchReportSchema, type CareerProfile, type JDAnalysis, type MatchReport } from "@/lib/schemas";
import type { Job } from "@/lib/ui-data";

export type JobAnalysisResult = {
  jobId: string;
  jd: JDAnalysis;
  match: MatchReport;
  meta: AgentMeta;
  profileUpdatedAt: string;
};

export type JobAnalysisStage = "jd" | "match";

export const JOB_ANALYSIS_EVENT = "zhihang-job-analysis-change";

export function subscribeJobAnalysis(onStoreChange: () => void) {
  window.addEventListener(JOB_ANALYSIS_EVENT, onStoreChange);
  return () => window.removeEventListener(JOB_ANALYSIS_EVENT, onStoreChange);
}

function cacheKey(jobId: string, profileUpdatedAt: string) {
  return `zhihang-job-analysis:${jobId}:${profileUpdatedAt}`;
}

export function jobToJDText(job: Job) {
  return [
    `公司：${job.company}`,
    `岗位：${job.role}`,
    `地点与类型：${job.location}`,
    `薪资：${job.salary}`,
    `岗位简介：${job.summary}`,
    `岗位职责：\n${job.responsibilities.map((item) => `- ${item}`).join("\n")}`,
    `任职要求：\n${job.requirements.map((item) => `- ${item}`).join("\n")}`,
  ].join("\n\n");
}

export function getCachedJobAnalysis(jobId: string, profileUpdatedAt: string) {
  if (typeof window === "undefined") return null;
  const saved = window.sessionStorage.getItem(cacheKey(jobId, profileUpdatedAt));
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as JobAnalysisResult;
    if (parsed.jobId === jobId && parsed.profileUpdatedAt === profileUpdatedAt && JDAnalysisSchema.safeParse(parsed.jd).success && MatchReportSchema.safeParse(parsed.match).success) return parsed;
  } catch {
    // Invalid or outdated analysis caches are safely discarded below.
  }
  window.sessionStorage.removeItem(cacheKey(jobId, profileUpdatedAt));
  return null;
}

export function getCachedJobScoresSnapshot(jobIds: string[], profileUpdatedAt: string) {
  if (typeof window === "undefined") return "{}";
  const scores: Record<string, number> = {};
  for (const jobId of jobIds) {
    const cached = getCachedJobAnalysis(jobId, profileUpdatedAt);
    if (cached) scores[jobId] = cached.match.score;
  }
  return JSON.stringify(scores);
}

export async function runJobAnalysis(job: Job, profile: CareerProfile, force = false, onStage?: (stage: JobAnalysisStage) => void): Promise<JobAnalysisResult> {
  if (!force) {
    const cached = getCachedJobAnalysis(job.id, profile.updatedAt);
    if (cached) return cached;
  }

  onStage?.("jd");
  const jdResponse = await runAgent<JDAnalysis>("jd", jobToJDText(job));
  onStage?.("match");
  const matchResponse = await runAgent<MatchReport>(
    "match",
    { targetJob: jdResponse.data.jobTitle, company: jdResponse.data.company },
    { profile, jd: jdResponse.data },
  );
  const result: JobAnalysisResult = {
    jobId: job.id,
    jd: jdResponse.data,
    match: matchResponse.data,
    meta: {
      provider: matchResponse.meta.provider,
      demo: jdResponse.meta.demo || matchResponse.meta.demo,
    },
    profileUpdatedAt: profile.updatedAt,
  };
  window.sessionStorage.setItem(cacheKey(job.id, profile.updatedAt), JSON.stringify(result));
  window.dispatchEvent(new Event(JOB_ANALYSIS_EVENT));
  return result;
}
