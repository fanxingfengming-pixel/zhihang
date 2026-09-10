import { timingSafeEqual } from "node:crypto";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getProductionReadiness } from "@/lib/production-readiness";
import { privateJson } from "@/lib/request-security";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.HEALTHCHECK_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("deep") !== "1") {
    return privateJson({
      status: "ok",
      timestamp: new Date().toISOString(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || undefined,
    });
  }
  if (!authorized(request)) return privateJson({ error: "未授权的深度健康检查。" }, { status: 401 });

  const readiness = getProductionReadiness();
  let database: { ok: boolean; usage?: unknown; error?: string } = {
    ok: false,
    error: "Supabase Secret Key 尚未配置",
  };
  if (isSupabaseAdminConfigured()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("ai_usage_summary");
      database = error
        ? { ok: false, error: "AI 用量迁移尚未应用或数据库不可用" }
        : { ok: true, usage: Array.isArray(data) ? data[0] : data };
    } catch {
      database = { ok: false, error: "Supabase 深度检查失败" };
    }
  }
  const ready = readiness.ready && database.ok;
  return privateJson({
    status: ready ? "ready" : "degraded",
    timestamp: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || undefined,
    readiness,
    database,
  }, { status: ready ? 200 : 503 });
}
