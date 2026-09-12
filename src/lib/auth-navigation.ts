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
