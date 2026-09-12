import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeInternalPath } from "@/lib/auth-navigation";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";

const PUBLIC_PATHS = new Set(["/login", "/auth/confirm"]);
const PUBLIC_API_PATHS = new Set(["/api/health", "/api/cron/jobs"]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname);
}

function loginRedirect(request: NextRequest, reason?: string) {
  const destination = request.nextUrl.clone();
  destination.pathname = "/login";
  destination.search = "";
  destination.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (reason) destination.searchParams.set("reason", reason);
  return NextResponse.redirect(destination);
}

function unauthenticatedApi() {
  return NextResponse.json(
    { error: "请先登录后再使用此功能。" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

function copyCookies(source: NextResponse, destination: NextResponse) {
  source.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie));
  return destination;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicPath = isPublicPath(pathname);
  if (!isSupabaseConfigured()) {
    if (publicPath) return NextResponse.next({ request });
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "登录服务尚未配置。" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return loginRedirect(request, "unconfigured");
  }

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const authenticated = !error && Boolean(userId);

  if (pathname === "/login" && authenticated) {
    const destination = request.nextUrl.clone();
    destination.pathname = safeInternalPath(request.nextUrl.searchParams.get("next"));
    destination.search = "";
    return copyCookies(response, NextResponse.redirect(destination));
  }
  if (!publicPath && !authenticated) {
    return pathname.startsWith("/api/") ? unauthenticatedApi() : loginRedirect(request);
  }
  return response;
}
