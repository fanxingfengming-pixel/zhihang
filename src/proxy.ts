import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/settings/:path*",
    "/api/sync/:path*",
    "/api/agents/:path*",
    "/api/chat/:path*",
    "/api/settings/ai/:path*",
    "/api/account/:path*",
    "/auth/:path*",
  ],
};
