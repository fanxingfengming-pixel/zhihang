export function safeInternalPath(value: string | null | undefined, fallback = "/") {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.split(/[?#]/, 1)[0] === "/login"
  ) return fallback;
  return value;
}

export const PENDING_VERIFICATION_EMAIL_KEY = "zhihang-pending-verification-email:v1";

export function maskEmail(value: string) {
  const [localPart, domain] = value.trim().split("@");
  if (!localPart || !domain) return value.trim();
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
}

export function buildAuthCallbackUrl(siteUrl: string, nextPath: string) {
  const url = new URL("/auth/confirm", siteUrl);
  url.searchParams.set("next", safeInternalPath(nextPath));
  return url.toString();
}
