import type { JobSource, LiveJob } from "@/lib/jobs/types";

const MAX_DESCRIPTION_LENGTH = 12_000;
const TAG_KEYWORDS = [
  "AI", "人工智能", "大模型", "LLM", "产品", "数据分析", "Python", "SQL", "JavaScript",
  "TypeScript", "React", "用户研究", "运营", "机器学习", "深度学习", "算法", "设计", "市场",
];

function decodeEntity(entity: string) {
  const named: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
  };
  const normalized = entity.toLowerCase();
  if (named[normalized]) return named[normalized];
  const numeric = normalized.startsWith("#x")
    ? Number.parseInt(normalized.slice(2), 16)
    : normalized.startsWith("#")
      ? Number.parseInt(normalized.slice(1), 10)
      : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 0x10ffff) return `&${entity};`;
  try {
    return String.fromCodePoint(numeric);
  } catch {
    return `&${entity};`;
  }
}

export function htmlToPlainText(value: unknown) {
  if (typeof value !== "string") return "";
  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(/&([#a-z0-9]+);/gi, (_match, entity: string) => decodeEntity(entity));
    if (next === decoded) break;
    decoded = next;
  }
  return decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:p|li|div|h[1-6]|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH);
}

export function safeHttpsUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function safeDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function inferJobTags(title: string, description: string) {
  const haystack = `${title}\n${description}`.toLowerCase();
  return TAG_KEYWORDS.filter((keyword) => haystack.includes(keyword.toLowerCase())).slice(0, 8);
}

export function buildLiveJob(input: {
  source: JobSource;
  sourceLabel: string;
  sourceFeed: string;
  externalId: string;
  company: string;
  role: string;
  location?: string;
  employmentType?: string;
  description?: string;
  sourceUrl: unknown;
  applyUrl?: unknown;
  publishedAt?: unknown;
}): LiveJob | null {
  const sourceUrl = safeHttpsUrl(input.sourceUrl);
  const applyUrl = safeHttpsUrl(input.applyUrl) || sourceUrl;
  const externalId = input.externalId.trim().slice(0, 500);
  const sourceFeed = input.sourceFeed.trim().slice(0, 120);
  const role = htmlToPlainText(input.role).slice(0, 240);
  if (!sourceUrl || !sourceFeed || !externalId || !role) return null;
  const description = htmlToPlainText(input.description);
  return {
    id: `${input.source}:${sourceFeed}:${externalId}`,
    source: input.source,
    sourceLabel: input.sourceLabel.trim().slice(0, 80),
    sourceFeed,
    externalId,
    company: htmlToPlainText(input.company).slice(0, 160) || "未注明公司",
    role,
    location: htmlToPlainText(input.location).slice(0, 200) || "地点未注明",
    employmentType: htmlToPlainText(input.employmentType).slice(0, 100) || "类型未注明",
    description,
    sourceUrl,
    applyUrl,
    publishedAt: safeDate(input.publishedAt),
    fetchedAt: new Date().toISOString(),
    tags: inferJobTags(role, description),
  };
}

export function deduplicateJobs(jobs: LiveJob[]) {
  const unique = new Map<string, LiveJob>();
  for (const job of jobs) unique.set(job.id, job);
  return [...unique.values()].toSorted((a, b) => {
    const left = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const right = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return right - left;
  });
}
