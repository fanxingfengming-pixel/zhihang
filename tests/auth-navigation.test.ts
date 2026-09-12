import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/auth-navigation";

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
});
