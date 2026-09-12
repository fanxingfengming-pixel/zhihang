import { VerifyEmailForm } from "@/components/verify-email-form";
import { safeInternalPath } from "@/lib/auth-navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; status?: string }>;
}) {
  const params = await searchParams;
  return (
    <VerifyEmailForm
      configured={isSupabaseConfigured()}
      nextPath={safeInternalPath(params.next)}
      invalidLink={params.status === "error"}
      captchaSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ""}
    />
  );
}
