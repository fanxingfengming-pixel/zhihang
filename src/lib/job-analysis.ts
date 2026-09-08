import { runAgent, type AgentMeta } from "@/lib/agent-client";
import { JDAnalysisSchema, MatchReportSchema, type CareerProfile, type JDAnalysis, type MatchReport } from "@/lib/schemas";
import type { Job } from "@/lib/ui-data";
import { readSessionStorageItem, writeSessionStorageItem } from "@/lib/browser-storage";

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
  return `zhihang-job-analysis:v1:${jobId}:${profileUpdatedAt}`;
}

export function jobToJDText(job: Job) {
  if (job.sourceText?.trim()) return job.sourceText.trim();
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

export function saveCachedJobAnalysis(result: JobAnalysisResult) {
  if (typeof window === "undefined") return false;
  try {
    if (!writeSessionStorageItem(cacheKey(result.jobId, result.profileUpdatedAt), JSON.stringify(result))) return false;
    window.dispatchEvent(new Event(JOB_ANALYSIS_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function getCachedJobAnalysis(jobId: string, profileUpdatedAt: string) {
  return parseCachedJobAnalysis(getCachedJobAnalysisSnapshot(jobId, profileUpdatedAt), jobId, profileUpdatedAt);
}

export function getCachedJobAnalysisSnapshot(jobId: string, profileUpdatedAt: string) {
  if (!jobId || typeof window === "undefined") return null;
  return readSessionStorageItem(cacheKey(jobId, profileUpdatedAt));
}

export function parseCachedJobAnalysis(snapshot: string | null, jobId: string, profileUpdatedAt: string) {
  if (!snapshot) return null;
  try {
    const parsed = JSON.parse(snapshot) as JobAnalysisResult;
    if (parsed.jobId === jobId && parsed.profileUpdatedAt === profileUpdatedAt && JDAnalysisSchema.safeParse(parsed.jd).success && MatchReportSchema.safeParse(parsed.match).success) return parsed;
  } catch {
    return null;
  }
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
  saveCachedJobAnalysis(result);
  return result;
}
