import { z } from "zod";
import { fetchExternalJson } from "@/lib/jobs/fetch-json";
import { buildLiveJob } from "@/lib/jobs/normalize";
import type { getAdzunaConfig } from "@/lib/jobs/source-config";

type AdzunaConfig = NonNullable<ReturnType<typeof getAdzunaConfig>>;

const AdzunaResponseSchema = z.object({
  results: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    title: z.string(),
    description: z.string().optional(),
    created: z.string().optional(),
    redirect_url: z.string(),
    contract_type: z.string().optional(),
    contract_time: z.string().optional(),
    company: z.object({ display_name: z.string().optional() }).optional(),
    location: z.object({ display_name: z.string().optional() }).optional(),
  }).passthrough()),
});

export async function fetchAdzunaJobs(config: AdzunaConfig) {
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${config.country}/search/1`);
  url.searchParams.set("app_id", config.appId);
  url.searchParams.set("app_key", config.appKey);
  url.searchParams.set("results_per_page", "50");
  url.searchParams.set("sort_by", "date");
  url.searchParams.set("what", config.query);
  const payload = AdzunaResponseSchema.parse(await fetchExternalJson(url));
  return payload.results.flatMap((job) => {
    const normalized = buildLiveJob({
      source: "adzuna",
      sourceLabel: "Adzuna",
      sourceFeed: config.country,
      externalId: String(job.id),
      company: job.company?.display_name || "未注明公司",
      role: job.title,
      location: job.location?.display_name,
      employmentType: [job.contract_time, job.contract_type].filter(Boolean).join(" · "),
      description: job.description,
      sourceUrl: job.redirect_url,
      publishedAt: job.created,
    });
    return normalized ? [normalized] : [];
  });
}
