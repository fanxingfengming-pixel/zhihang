import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { privateJson, protectMutation, RequestSecurityError, requestSecurityError } from "@/lib/request-security";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    protectMutation(request, "account-delete", { limit: 3, windowMs: 60 * 60 * 1000 });
    if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
      return privateJson({ error: "账号删除服务尚未配置，请联系管理员。" }, { status: 503 });
    }

    const userClient = await createClient();
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      throw new RequestSecurityError("请先登录后再删除账号。", 401);
    }
    const { data: sessionData } = await userClient.auth.getSession();
    const admin = createAdminClient();
    const accessToken = sessionData.session?.access_token;
    if (accessToken) {
      const { error: signOutError } = await admin.auth.admin.signOut(accessToken, "global");
      if (signOutError) return privateJson({ error: "注销账号会话失败，请稍后重试。" }, { status: 502 });
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
    if (deleteError) return privateJson({ error: "账号删除失败，请稍后重试。" }, { status: 502 });

    return privateJson({ ok: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityError(error);
    return privateJson({ error: "账号删除失败，请稍后重试。" }, { status: 500 });
  }
}
