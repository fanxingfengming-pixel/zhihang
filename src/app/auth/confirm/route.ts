import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/settings";
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();

  const result = tokenHash && type
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    : code
      ? await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
      : { error: new Error("Missing confirmation token") };

  const destination = request.nextUrl.clone();
  destination.pathname = result.error ? "/settings" : next;
  destination.search = result.error ? "?auth=error" : "?auth=confirmed";
  destination.hash = result.error || next !== "/settings" ? "" : "cloud-sync";
  return NextResponse.redirect(destination);
}
