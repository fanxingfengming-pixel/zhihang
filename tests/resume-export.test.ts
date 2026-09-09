import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import { describe, expect, it } from "vitest";
import { buildResumeExportContent, buildResumeFilename, hasResumeExportContent } from "@/lib/resume-export/content";
import { generateResumeDocx } from "@/lib/resume-export/docx";
import { generateResumePdf } from "@/lib/resume-export/pdf";
import { EMPTY_PROFILE, type CareerProfile } from "@/lib/schemas";

const profile: CareerProfile = {
  basics: {
    name: "李明",
    school: "示例大学",
    major: "信息管理与信息系统",
    grade: "大三",
    targetRole: "AI 产品实习生",
    location: "杭州",
    industry: "人工智能",
    careerStage: "在校生",
  },
  skills: ["Figma", "数据分析", "AI Agent"],
  strengths: ["能够把用户访谈证据转化为产品需求", "重视可验证的交付结果"],
  projects: [{
    title: "大学生求职助手",
    organization: "校级创新项目",
    period: "2026.03—2026.08",
    role: "产品负责人",
    details: ["访谈 20 名学生并整理核心求职痛点", "完成产品原型与智能体工作流设计"],
    result: "交付可运行的求职实训 MVP",
  }],
  resumeMarkdown: "",
  updatedAt: "2026-09-09T00:00:00.000Z",
};

describe("resume export", () => {
  it("只整理档案中已有的结构化信息并生成安全文件名", () => {
    const content = buildResumeExportContent({
      ...profile,
      basics: { ...profile.basics, name: "李\u0000明/测试" },
      skills: ["Figma", " Figma ", "数据\u200b分析"],
    });
    expect(content.name).toBe("李明/测试");
    expect(content.skills).toEqual(["Figma", "数据分析"]);
    expect(buildResumeFilename(profile, "pdf")).toBe("李明-AI 产品实习生-简历.pdf");
    expect(buildResumeFilename({ ...profile, basics: { ...profile.basics, name: "李/明" } }, "docx")).toBe("李-明-AI 产品实习生-简历.docx");
    expect(hasResumeExportContent(EMPTY_PROFILE)).toBe(false);
  });

  it("生成包含中文内容的可编辑 DOCX", async () => {
    const bytes = await generateResumeDocx(profile);
    expect(bytes.byteLength).toBeGreaterThan(5_000);
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    const extracted = await mammoth.extractRawText({ buffer: bytes });
    expect(extracted.value).toContain("李明");
    expect(extracted.value).toContain("大学生求职助手");
    expect(extracted.value).toContain("交付可运行的求职实训 MVP");
  });

  it("生成内嵌中文字体的有效 PDF", async () => {
    const bytes = await generateResumePdf(profile);
    expect(bytes.byteLength).toBeGreaterThan(20_000);
    expect(Buffer.from(bytes.subarray(0, 4)).toString()).toBe("%PDF");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getTitle()).toBe("李明简历");
  });
});
