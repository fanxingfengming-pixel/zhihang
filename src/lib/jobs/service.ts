import { readJobCache, writeJobCache } from "@/lib/jobs/cache";
import { deduplicateJobs } from "@/lib/jobs/normalize";
import { cacheMinutes, getAdzunaConfig, getAtsBoards, liveJobsEnabled } from "@/lib/jobs/source-config";
import { fetchAdzunaJobs } from "@/lib/jobs/sources/adzuna";
import { fetchAshbyJobs } from "@/lib/jobs/sources/ashby";
import { fetchGreenhouseJobs } from "@/lib/jobs/sources/greenhouse";
import { fetchLeverJobs } from "@/lib/jobs/sources/lever";
import type { JobSource, LiveJob, LiveJobsPayload } from "@/lib/jobs/types";

type FeedResult = {
  source: JobSource;
  sourceFeed: string;
  label: string;
  jobs: LiveJob[];
};

type PendingFeed = {
  source: JobSource;
  label: string;
  promise: Promise<FeedResult>;
};

const globalCache = globalThis as typeof globalThis & {
  __zhihangLiveJobs?: { payload: LiveJobsPayload; expiresAt: number };
};

function maxPerFeed() {
  const configured = Number(process.env.LIVE_JOBS_MAX_PER_SOURCE);
  return Number.isFinite(configured) ? Math.min(300, Math.max(10, configured)) : 150;
}

async function fetchFeedJobs() {
  const tasks: PendingFeed[] = getAtsBoards().map((board) => ({
    source: board.source,
    label: board.company,
    promise: (async () => {
      const jobs = board.source === "greenhouse"
        ? await fetchGreenhouseJobs(board)
        : board.source === "lever"
          ? await fetchLeverJobs(board)
          : await fetchAshbyJobs(board);
      return { source: board.source, sourceFeed: board.token, label: board.company, jobs: jobs.slice(0, maxPerFeed()) };
    })(),
  }));
  const adzuna = getAdzunaConfig();
  if (adzuna) {
    tasks.push({
      source: "adzuna",
      label: "Adzuna",
      promise: fetchAdzunaJobs(adzuna).then((jobs) => ({
        source: "adzuna" as const,
        sourceFeed: adzuna.country,
        label: "Adzuna",
        jobs: jobs.slice(0, maxPerFeed()),
      })),
    });
  }
  const settled = await Promise.allSettled(tasks.map((task) => task.promise));
  const feeds: FeedResult[] = [];
  const warnings: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") feeds.push(result.value);
    else {
      const task = tasks[index];
      const reason = result.reason instanceof Error && /响应过大|HTTP \d{3}|合法 JSON/.test(result.reason.message)
        ? `：${result.reason.message}`
        : "";
      warnings.push(`${task.label}（${task.source}）暂时不可用，已跳过${reason}。`);
    }
  });
  return { feeds, warnings };
}

function summarizeSources(jobs: LiveJob[]) {
  const counts = new Map<JobSource, number>();
  for (const job of jobs) counts.set(job.source, (counts.get(job.source) || 0) + 1);
  const labels: Record<JobSource, string> = {
    greenhouse: "Greenhouse",
    lever: "Lever",
    ashby: "Ashby",
    adzuna: "Adzuna",
  };
  return [...counts.entries()].map(([source, count]) => ({ source, label: labels[source], count }));
}

function payloadFromJobs(jobs: LiveJob[], cached: boolean, warnings: string[]): LiveJobsPayload {
  const fetchedAt = jobs.reduce((latest, job) => job.fetchedAt > latest ? job.fetchedAt : latest, "") || new Date().toISOString();
  return { jobs, fetchedAt, cached, sources: summarizeSources(jobs), warnings };
}

export async function refreshLiveJobs() {
  if (!liveJobsEnabled()) return payloadFromJobs([], false, ["实时岗位已在环境配置中关闭。"]);
  const { feeds, warnings } = await fetchFeedJobs();
  const jobs = deduplicateJobs(feeds.flatMap((feed) => feed.jobs));
  if (!jobs.length) throw new Error("所有公开岗位源暂时不可用");
  const expiresAt = new Date(Date.now() + cacheMinutes() * 60_000).toISOString();
  try {
    await writeJobCache(jobs, feeds.map((feed) => ({ source: feed.source, sourceFeed: feed.sourceFeed })), expiresAt);
  } catch {
    warnings.push("Supabase 岗位缓存尚不可用，本次结果仅保存在服务进程中。");
  }
  const payload = payloadFromJobs(jobs, false, warnings);
  globalCache.__zhihangLiveJobs = { payload, expiresAt: Date.parse(expiresAt) };
  return payload;
}

export async function getLiveJobs() {
  if (!liveJobsEnabled()) return payloadFromJobs([], false, ["实时岗位已在环境配置中关闭。"]);
  if (globalCache.__zhihangLiveJobs && globalCache.__zhihangLiveJobs.expiresAt > Date.now()) {
    return { ...globalCache.__zhihangLiveJobs.payload, cached: true };
  }
  try {
    const cache = await readJobCache();
    if (cache.jobs.length) {
      const payload = payloadFromJobs(cache.jobs, true, []);
      globalCache.__zhihangLiveJobs = {
        payload,
        expiresAt: Date.now() + Math.min(cacheMinutes(), 15) * 60_000,
      };
      return payload;
    }
  } catch {
    // A missing migration must not prevent the public feeds from working.
  }
  try {
    return await refreshLiveJobs();
  } catch (error) {
    try {
      const stale = await readJobCache({ includeExpired: true });
      if (stale.jobs.length) return payloadFromJobs(stale.jobs, true, ["公开岗位源暂时不可用，正在显示最近一次缓存。"]);
    } catch {
      // The route will return a controlled upstream error below.
    }
    throw error;
  }
}

export function resetLiveJobsCacheForTests() {
  delete globalCache.__zhihangLiveJobs;
}
