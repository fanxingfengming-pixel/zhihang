import { EmailConfirmedCard } from "@/components/email-confirmed-card";
import { safeInternalPath } from "@/lib/auth-navigation";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    redirect(`/verify-email?status=error&next=${encodeURIComponent(nextPath)}`);
  }
  return <EmailConfirmedCard nextPath={nextPath} />;
}
