import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { WorkspaceSnapshotSchema } from "@/lib/workspace-sync";

function unavailable() {
  return NextResponse.json({ error: "云同步尚未配置，当前数据仍安全保存在本机浏览器。" }, { status: 503 });
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
  if (!userId) return NextResponse.json({ error: "请先登录后再读取云端数据。" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_workspaces")
    .select("snapshot, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: `读取失败：${error.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ data: null, updatedAt: null });

  const parsed = WorkspaceSnapshotSchema.safeParse(data.snapshot);
  if (!parsed.success) return NextResponse.json({ error: "云端数据格式无法识别，请重新上传本机数据。" }, { status: 422 });
  return NextResponse.json({ data: parsed.data, updatedAt: data.updated_at });
}

export async function PUT(request: Request) {
  if (!isSupabaseConfigured()) return unavailable();
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: "请先登录后再同步数据。" }, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "请求不是有效的 JSON。" }, { status: 400 });
  }
  const parsed = WorkspaceSnapshotSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "本机工作区数据格式校验失败。" }, { status: 400 });

  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from("user_workspaces").upsert(
    { user_id: userId, snapshot: parsed.data, updated_at: updatedAt },
    { onConflict: "user_id" },
  );
  if (error) return NextResponse.json({ error: `同步失败：${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, updatedAt });
}
