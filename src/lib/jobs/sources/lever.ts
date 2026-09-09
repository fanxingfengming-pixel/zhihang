import { z } from "zod";
import { fetchExternalJson } from "@/lib/jobs/fetch-json";
import { buildLiveJob, htmlToPlainText } from "@/lib/jobs/normalize";
import type { AtsBoardConfig } from "@/lib/jobs/source-config";

const LeverResponseSchema = z.array(z.object({
  id: z.string(),
  text: z.string(),
  descriptionPlain: z.string().optional(),
  openingPlain: z.string().optional(),
  additionalPlain: z.string().optional(),
  hostedUrl: z.string(),
  applyUrl: z.string().optional(),
  createdAt: z.number().optional(),
  categories: z.object({
    location: z.string().optional(),
    commitment: z.string().optional(),
  }).passthrough().optional(),
  lists: z.array(z.object({ text: z.string(), content: z.string() })).optional(),
}).passthrough());

export async function fetchLeverJobs(board: AtsBoardConfig) {
  const url = new URL(`https://api.lever.co/v0/postings/${encodeURIComponent(board.token)}`);
  url.searchParams.set("mode", "json");
  const payload = LeverResponseSchema.parse(await fetchExternalJson(url));
  return payload.flatMap((job) => {
    const listText = job.lists?.map((item) => `${item.text}\n${htmlToPlainText(item.content)}`).join("\n\n") || "";
    const description = [job.openingPlain, job.descriptionPlain, listText, job.additionalPlain].filter(Boolean).join("\n\n");
    const normalized = buildLiveJob({
      source: "lever",
      sourceLabel: "Lever",
      sourceFeed: board.token,
      externalId: job.id,
      company: board.company,
      role: job.text,
      location: job.categories?.location,
      employmentType: job.categories?.commitment,
      description,
      sourceUrl: job.hostedUrl,
      applyUrl: job.applyUrl,
      publishedAt: job.createdAt,
    });
    return normalized ? [normalized] : [];
  });
}
