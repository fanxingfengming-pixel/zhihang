import { LoginForm } from "@/components/login-form";
import { safeInternalPath } from "@/lib/auth-navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; auth?: string; reason?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const initialMessage = params.auth === "error"
    ? "验证链接无效或已经过期，请重新登录。"
    : params.reason === "unconfigured"
      ? "线上登录服务尚未完成配置，请联系管理员。"
      : "";

  return (
    <LoginForm
      configured={isSupabaseConfigured()}
      nextPath={safeInternalPath(params.next)}
      initialMode={params.mode === "signup" ? "signup" : "signin"}
      captchaSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ""}
      initialMessage={initialMessage}
    />
  );
}
