import { describe, expect, it } from "vitest";
import { liveJobToUiJob } from "@/lib/jobs/client";
import { buildLiveJob, deduplicateJobs, htmlToPlainText, safeHttpsUrl } from "@/lib/jobs/normalize";

describe("live job normalization", () => {
  it("removes executable HTML and rejects unsafe links", () => {
    expect(htmlToPlainText("&lt;p&gt;Build AI products &amp;amp; analytics&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;<li>Use SQL</li>"))
      .toBe("Build AI products & analytics\nUse SQL");
    expect(safeHttpsUrl("javascript:alert(1)")).toBe("");
    expect(safeHttpsUrl("http://example.com/job")).toBe("");
  });

  it("uses the provider and feed in stable IDs", () => {
    const job = buildLiveJob({
      source: "greenhouse",
      sourceLabel: "Greenhouse",
      sourceFeed: "sample",
      externalId: "42",
      company: "示例公司",
      role: "AI 产品实习生",
      description: "负责 AI 产品设计与 SQL 数据分析。",
      sourceUrl: "https://example.com/jobs/42",
      publishedAt: "2026-09-08T00:00:00Z",
    });
    expect(job?.id).toBe("greenhouse:sample:42");
    expect(job?.tags).toEqual(expect.arrayContaining(["AI", "产品", "数据分析", "SQL"]));
  });

  it("deduplicates jobs and maps public data into the existing Job model", () => {
    const older = buildLiveJob({
      source: "ashby", sourceLabel: "Ashby", sourceFeed: "sample", externalId: "abc",
      company: "示例公司", role: "产品实习生", description: "参与需求分析。",
      sourceUrl: "https://example.com/jobs/abc", publishedAt: "2026-09-01T00:00:00Z",
    });
    expect(older).not.toBeNull();
    const jobs = deduplicateJobs([older!, { ...older!, role: "AI 产品实习生" }]);
    expect(jobs).toHaveLength(1);
    const uiJob = liveJobToUiJob(jobs[0]);
    expect(uiJob.isLive).toBe(true);
    expect(uiJob.role).toBe("AI 产品实习生");
    expect(uiJob.sourceText).toContain("公司：示例公司");
    expect(uiJob.applyUrl).toBe("https://example.com/jobs/abc");
  });
});
