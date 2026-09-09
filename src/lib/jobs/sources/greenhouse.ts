import { z } from "zod";
import { fetchExternalJson } from "@/lib/jobs/fetch-json";
import { buildLiveJob } from "@/lib/jobs/normalize";
import type { AtsBoardConfig } from "@/lib/jobs/source-config";

const GreenhouseResponseSchema = z.object({
  jobs: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    title: z.string(),
    updated_at: z.string().optional(),
    absolute_url: z.string(),
    content: z.string().optional(),
    location: z.object({ name: z.string().optional() }).optional(),
  }).passthrough()),
});

export async function fetchGreenhouseJobs(board: AtsBoardConfig) {
  const url = new URL(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.token)}/jobs`);
  url.searchParams.set("content", "true");
  const payload = GreenhouseResponseSchema.parse(await fetchExternalJson(url));
  return payload.jobs.flatMap((job) => {
    const normalized = buildLiveJob({
      source: "greenhouse",
      sourceLabel: "Greenhouse",
      sourceFeed: board.token,
      externalId: String(job.id),
      company: board.company,
      role: job.title,
      location: job.location?.name,
      description: job.content,
      sourceUrl: job.absolute_url,
      publishedAt: job.updated_at,
    });
    return normalized ? [normalized] : [];
  });
}
