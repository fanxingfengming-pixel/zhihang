import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth-navigation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  const next = safeInternalPath(request.nextUrl.searchParams.get("next"));
  const recoveryFlow = type === "recovery" || next.split(/[?#]/, 1)[0] === "/auth/update-password";
  const supabase = await createClient();

  const result = tokenHash && type
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    : code
      ? await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
      : { error: new Error("Missing confirmation token") };

  const destination = request.nextUrl.clone();
  destination.search = "";
  destination.hash = "";
  if (result.error) {
    destination.pathname = recoveryFlow ? "/login" : "/verify-email";
    destination.searchParams.set(recoveryFlow ? "auth" : "status", "error");
    destination.searchParams.set("next", next);
    return NextResponse.redirect(destination);
  }
  if (recoveryFlow) {
    destination.pathname = "/auth/update-password";
    destination.searchParams.set("auth", "recovery");
    return NextResponse.redirect(destination);
  }
  destination.pathname = "/auth/confirmed";
  destination.searchParams.set("next", next);
  return NextResponse.redirect(destination);
}
