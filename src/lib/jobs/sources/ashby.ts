import { z } from "zod";
import { fetchExternalJson } from "@/lib/jobs/fetch-json";
import { buildLiveJob } from "@/lib/jobs/normalize";
import type { AtsBoardConfig } from "@/lib/jobs/source-config";

const AshbyResponseSchema = z.object({
  jobs: z.array(z.object({
    id: z.string().optional(),
    title: z.string(),
    location: z.string().optional(),
    descriptionPlain: z.string().optional(),
    publishedAt: z.string().optional(),
    employmentType: z.string().optional(),
    jobUrl: z.string(),
    applyUrl: z.string().optional(),
    isListed: z.boolean().optional(),
  }).passthrough()),
});

export async function fetchAshbyJobs(board: AtsBoardConfig) {
  const url = new URL(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board.token)}`);
  const payload = AshbyResponseSchema.parse(await fetchExternalJson(url));
  return payload.jobs.flatMap((job) => {
    if (job.isListed === false) return [];
    const fallbackId = job.jobUrl.split("/").filter(Boolean).at(-1) || `${job.title}-${job.location || "unknown"}`;
    const normalized = buildLiveJob({
      source: "ashby",
      sourceLabel: "Ashby",
      sourceFeed: board.token,
      externalId: job.id || fallbackId,
      company: board.company,
      role: job.title,
      location: job.location,
      employmentType: job.employmentType,
      description: job.descriptionPlain,
      sourceUrl: job.jobUrl,
      applyUrl: job.applyUrl,
      publishedAt: job.publishedAt,
    });
    return normalized ? [normalized] : [];
  });
}
