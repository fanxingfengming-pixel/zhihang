import { getLiveJobs } from "@/lib/jobs/service";
import type { JobSource } from "@/lib/jobs/types";

export const runtime = "nodejs";

const SOURCES = new Set<JobSource>(["greenhouse", "lever", "ashby", "adzuna"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase().slice(0, 120);
    const location = (searchParams.get("location") || "").trim().toLowerCase().slice(0, 120);
    const requestedSource = searchParams.get("source") as JobSource | null;
    const source = requestedSource && SOURCES.has(requestedSource) ? requestedSource : null;
    const requestedLimit = Number(searchParams.get("limit"));
    const limit = Number.isFinite(requestedLimit) ? Math.min(120, Math.max(1, requestedLimit)) : 120;
    const payload = await getLiveJobs();
    const jobs = payload.jobs.filter((job) => {
      const haystack = `${job.company} ${job.role} ${job.location} ${job.tags.join(" ")}`.toLowerCase();
      return (!query || haystack.includes(query))
        && (!location || job.location.toLowerCase().includes(location))
        && (!source || job.source === source);
    }).slice(0, limit);
    return Response.json({ ...payload, jobs }, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "实时岗位暂时不可用，请稍后重试或粘贴真实 JD。" }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
