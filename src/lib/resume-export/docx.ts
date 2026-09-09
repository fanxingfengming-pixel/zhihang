import {
  AlignmentType,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  TextRun,
} from "docx";
import type { CareerProfile } from "@/lib/schemas";
import { buildResumeExportContent } from "@/lib/resume-export/content";

const FONT = "Microsoft YaHei";
const INK = "152536";
const MUTED = "5F7284";
const ACCENT = "315F87";

function text(value: string, options: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text: value,
    bold: options.bold,
    size: options.size ?? 21,
    color: options.color ?? INK,
    font: FONT,
  });
}

function sectionHeading(title: string, english: string) {
  return new Paragraph({
    spacing: { before: 260, after: 100 },
    keepNext: true,
    children: [
      text(title, { bold: true, size: 23 }),
      text(`  ${english}`, { bold: true, size: 15, color: "94A3B0" }),
    ],
  });
}

function bullet(value: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 55, line: 310 },
    children: [text(value, { size: 20, color: MUTED })],
  });
}

export async function generateResumeDocx(profile: CareerProfile) {
  const content = buildResumeExportContent(profile);
  const children: Paragraph[] = [];

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [text(content.name || "个人简历", { bold: true, size: 38 })],
  }));

  const headline = [content.targetRole, content.contactLine].filter(Boolean).join("  ·  ");
  if (headline) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 210 },
      children: [text(headline, { size: 20, color: ACCENT })],
    }));
  }

  if (content.school || content.educationLine) {
    children.push(sectionHeading("教育经历", "EDUCATION"));
    children.push(new Paragraph({
      spacing: { after: 70, line: 300 },
      keepNext: true,
      children: [
        ...(content.school ? [text(content.school, { bold: true, size: 21 })] : []),
        ...(content.school && content.educationLine ? [text("  ·  ", { size: 19, color: MUTED })] : []),
        ...(content.educationLine ? [text(content.educationLine, { size: 20, color: MUTED })] : []),
      ],
    }));
  }

  if (content.projects.length) {
    children.push(sectionHeading("项目经历", "PROJECT EXPERIENCE"));
    for (const [index, project] of content.projects.entries()) {
      const metadata = [project.organization, project.role, project.period].filter(Boolean).join(" · ");
      if (project.title) {
        children.push(new Paragraph({
          spacing: { before: index ? 130 : 0, after: 35 },
          keepNext: true,
          children: [text(project.title, { bold: true, size: 21 })],
        }));
      }
      if (metadata) {
        children.push(new Paragraph({
          spacing: { after: 65 },
          keepNext: true,
          children: [text(metadata, { size: 18, color: MUTED })],
        }));
      }
      for (const detail of project.details) children.push(bullet(detail));
      if (project.result) children.push(bullet(`成果：${project.result}`));
    }
  }

  if (content.skills.length) {
    children.push(sectionHeading("核心技能", "SKILLS"));
    children.push(new Paragraph({
      spacing: { after: 80, line: 310 },
      children: [text(content.skills.join("  ·  "), { size: 20, color: MUTED })],
    }));
  }

  if (content.strengths.length) {
    children.push(sectionHeading("个人优势", "STRENGTHS"));
    for (const strength of content.strengths) children.push(bullet(strength));
  }

  const document = new Document({
    creator: "职航",
    title: `${content.name || "个人"}简历`,
    description: "由职航 Career Profile 生成的可编辑简历",
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 21, color: INK },
          paragraph: { spacing: { line: 300 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12_240, height: 15_840, orientation: PageOrientation.PORTRAIT },
          margin: { top: 720, right: 820, bottom: 720, left: 820 },
        },
      },
      children,
    }],
  });

  return Packer.toBuffer(document);
}
