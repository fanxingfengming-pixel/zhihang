import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { WorkspaceSnapshotSchema } from "@/lib/workspace-sync";
import { privateJson, protectMutation, readJsonWithLimit, RequestSecurityError, requestSecurityError } from "@/lib/request-security";
import { z } from "zod";

const SyncWriteSchema = z.object({
  snapshot: WorkspaceSnapshotSchema,
  expectedUpdatedAt: z.string().nullable(),
});

function unavailable() {
  return privateJson({ error: "云同步尚未配置，当前数据仍安全保存在本机浏览器。" }, { status: 503 });
}

async function authenticatedUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { supabase, userId: null };
  return { supabase, userId };
}

export async function GET() {
  if (!isSupabaseConfigured()) return unavailable();
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return privateJson({ error: "请先登录后再读取云端数据。" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_workspaces")
    .select("snapshot, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return privateJson({ error: "云端数据读取失败，请稍后重试。" }, { status: 500 });
  if (!data) return privateJson({ data: null, updatedAt: null });

  const parsed = WorkspaceSnapshotSchema.safeParse(data.snapshot);
  if (!parsed.success) return privateJson({ error: "云端数据格式无法识别，请重新上传本机数据。" }, { status: 422 });
  return privateJson({ data: parsed.data, updatedAt: data.updated_at });
}

export async function PUT(request: Request) {
  try {
    protectMutation(request, "workspace-sync", { limit: 20 });
    if (!isSupabaseConfigured()) return unavailable();
    const { supabase, userId } = await authenticatedUserId();
    if (!userId) return privateJson({ error: "请先登录后再同步数据。" }, { status: 401 });

    const parsed = SyncWriteSchema.safeParse(await readJsonWithLimit(request, 1024 * 1024));
    if (!parsed.success) return privateJson({ error: "本机工作区数据格式校验失败。" }, { status: 400 });

    const updatedAt = new Date().toISOString();
    if (parsed.data.expectedUpdatedAt) {
      const { data, error } = await supabase.from("user_workspaces")
        .update({ snapshot: parsed.data.snapshot, updated_at: updatedAt })
        .eq("user_id", userId)
        .eq("updated_at", parsed.data.expectedUpdatedAt)
        .select("updated_at")
        .maybeSingle();
      if (error) return privateJson({ error: "同步失败，请稍后重试。" }, { status: 500 });
      if (!data) return privateJson({ error: "云端数据已在其他设备更新。请先从云端恢复，再决定是否重新上传。" }, { status: 409 });
    } else {
      const { error } = await supabase.from("user_workspaces").insert({
        user_id: userId,
        snapshot: parsed.data.snapshot,
        updated_at: updatedAt,
      });
      if (error?.code === "23505") return privateJson({ error: "云端已经存在更新版本，请先从云端恢复。" }, { status: 409 });
      if (error) return privateJson({ error: "同步失败，请稍后重试。" }, { status: 500 });
    }
    return privateJson({ ok: true, updatedAt });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityError(error);
    return privateJson({ error: "同步失败，请稍后重试。" }, { status: 500 });
  }
}
