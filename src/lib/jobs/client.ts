import type { LiveJob } from "@/lib/jobs/types";
import type { Job } from "@/lib/ui-data";
import { htmlToPlainText } from "@/lib/jobs/normalize";

function postedLabel(publishedAt: string | null) {
  if (!publishedAt) return "来源实时更新";
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return "来源实时更新";
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return "今天更新";
  if (days < 30) return `${days} 天前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(timestamp);
}

function descriptionItems(description: string) {
  return description
    .split(/\n+/)
    .map((item) => item.replace(/^[\s•·*\-\d.)、]+/, "").trim())
    .filter((item) => item.length >= 8)
    .slice(0, 8);
}

export function liveJobToUiJob(job: LiveJob): Job {
  const description = htmlToPlainText(job.description);
  const details = descriptionItems(description);
  const summary = details[0] || description.slice(0, 220) || "请前往职位原页面查看完整职责与要求。";
  const sourceText = [
    `公司：${job.company}`,
    `岗位：${job.role}`,
    `地点：${job.location || "未注明"}`,
    `类型：${job.employmentType || "未注明"}`,
    "",
    description,
  ].join("\n");

  return {
    id: job.id,
    company: job.company,
    role: job.role,
    location: job.location || "地点未注明",
    salary: job.employmentType || "薪资未公开",
    match: 0,
    initials: (job.company || "岗").slice(0, 1),
    posted: postedLabel(job.publishedAt),
    createdAt: job.publishedAt || job.fetchedAt,
    sourceText,
    tags: job.tags,
    summary,
    responsibilities: details.length ? details : [summary],
    requirements: [],
    scores: [],
    strengths: [],
    gaps: [],
    source: job.source,
    sourceLabel: job.sourceLabel,
    sourceUrl: job.sourceUrl,
    applyUrl: job.applyUrl,
    employmentType: job.employmentType,
    publishedAt: job.publishedAt,
    fetchedAt: job.fetchedAt,
    isLive: true,
  };
}
