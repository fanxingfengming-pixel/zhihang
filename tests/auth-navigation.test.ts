import { describe, expect, it } from "vitest";
import { buildAuthCallbackUrl, maskEmail, safeInternalPath } from "@/lib/auth-navigation";

describe("safeInternalPath", () => {
  it("preserves application-local destinations", () => {
    expect(safeInternalPath("/jobs?q=ai")).toBe("/jobs?q=ai");
  });

  it("rejects external or missing destinations", () => {
    expect(safeInternalPath("https://example.com")).toBe("/");
    expect(safeInternalPath("//example.com")).toBe("/");
    expect(safeInternalPath("/\\example.com")).toBe("/");
    expect(safeInternalPath("/login?next=/login")).toBe("/");
    expect(safeInternalPath(null)).toBe("/");
  });

  it("builds a production callback without allowing an external next target", () => {
    expect(buildAuthCallbackUrl("https://zhihang.example", "/jobs?q=ai"))
      .toBe("https://zhihang.example/auth/confirm?next=%2Fjobs%3Fq%3Dai");
    expect(buildAuthCallbackUrl("https://zhihang.example", "https://evil.example"))
      .toBe("https://zhihang.example/auth/confirm?next=%2F");
  });

  it("masks pending verification email addresses", () => {
    expect(maskEmail("student@example.com")).toBe("st*****@example.com");
    expect(maskEmail("a@example.com")).toBe("a**@example.com");
  });
});
