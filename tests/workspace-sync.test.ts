import { describe, expect, it } from "vitest";
import { DEFAULT_APPLICATIONS } from "@/lib/application-store";
import { DEFAULT_CAREER_PROFILE } from "@/lib/career-profile-store";
import { WorkspaceSnapshotSchema } from "@/lib/workspace-sync";

describe("workspace sync contract", () => {
  it("accepts a complete versioned workspace snapshot", () => {
    const result = WorkspaceSnapshotSchema.safeParse({
      version: 1,
      exportedAt: "2026-09-07T00:00:00.000Z",
      profile: DEFAULT_CAREER_PROFILE,
      applications: DEFAULT_APPLICATIONS,
      careerIntelligence: null,
      interviewHistory: [],
      offerHistory: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown snapshot versions and partial payloads", () => {
    expect(WorkspaceSnapshotSchema.safeParse({ version: 2 }).success).toBe(false);
  });
});
