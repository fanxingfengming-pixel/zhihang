import { refreshLiveJobs } from "@/lib/jobs/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const payload = await refreshLiveJobs();
    return Response.json({ ok: true, count: payload.jobs.length, fetchedAt: payload.fetchedAt }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "岗位刷新失败" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
