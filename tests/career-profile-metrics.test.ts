import { describe, expect, it } from "vitest";
import { calculateProfileCompletion, countProjectsMissingResults } from "@/lib/career-profile-metrics";
import { EMPTY_PROFILE, type CareerProfile } from "@/lib/schemas";

describe("career profile metrics", () => {
  it("returns zero for a genuinely empty profile", () => {
    expect(calculateProfileCompletion(EMPTY_PROFILE)).toBe(0);
    expect(countProjectsMissingResults(EMPTY_PROFILE)).toBe(0);
  });

  it("uses only persisted profile fields and reports missing project results", () => {
    const profile: CareerProfile = {
      basics: {
        name: "林小满",
        school: "南华大学",
        major: "工业设计",
        grade: "大三",
        targetRole: "AI 产品实习生",
        location: "长沙",
      },
      skills: ["Figma"],
      strengths: [],
      projects: [{ title: "职航", organization: "校内", period: "2026", role: "产品", details: ["完成原型"], result: "" }],
      resumeMarkdown: "# 简历",
      updatedAt: "2026-09-07T00:00:00.000Z",
    };

    expect(calculateProfileCompletion(profile)).toBe(100);
    expect(countProjectsMissingResults(profile)).toBe(1);
    profile.projects[0].result = "完成 8 次用户测试";
    expect(countProjectsMissingResults(profile)).toBe(0);
  });
});
