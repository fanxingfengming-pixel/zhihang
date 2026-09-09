import unicodeRanges from "@fontsource/noto-sans-sc/unicode.json";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { CareerProfile } from "@/lib/schemas";
import { buildResumeExportContent } from "@/lib/resume-export/content";

const MARGIN_X = 54;
const MARGIN_TOP = 51;
const MARGIN_BOTTOM = 48;
const INK = "#152536";
const MUTED = "#5f7284";
const ACCENT = "#315f87";
const FONT_DIR = path.join(process.cwd(), "node_modules", "@fontsource", "noto-sans-sc", "files");
const BUILTIN_CHARACTERS = /^[\u0020-\u00ff\u2013\u2014\u2022]$/;

type CodepointRange = { start: number; end: number };
type FontChunk = { id: string; ranges: CodepointRange[] };
type Glyph = { character: string; font: string; width: number };
type TextLine = { glyphs: Glyph[]; width: number };

const FONT_CHUNKS: FontChunk[] = Object.entries(unicodeRanges)
  .filter(([name]) => /^\[\d+\]$/.test(name))
  .map(([name, declaration]) => ({
    id: name.slice(1, -1),
    ranges: declaration.split(",").flatMap((part) => {
      const match = part.trim().match(/^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i);
      if (!match) return [];
      return [{ start: Number.parseInt(match[1], 16), end: Number.parseInt(match[2] || match[1], 16) }];
    }),
  }));

function fontChunkFor(character: string) {
  if (BUILTIN_CHARACTERS.test(character)) return null;
  const codepoint = character.codePointAt(0);
  if (codepoint === undefined || codepoint > 0xffff) return null;
  return FONT_CHUNKS.find((chunk) => chunk.ranges.some((range) => codepoint >= range.start && codepoint <= range.end))?.id ?? null;
}

function requiredFontChunks(value: string) {
  return [...new Set(Array.from(value).map(fontChunkFor).filter((chunk): chunk is string => Boolean(chunk)))];
}

export async function generateResumePdf(profile: CareerProfile) {
  const content = buildResumeExportContent(profile);
  const allText = [
    content.name,
    content.targetRole,
    content.contactLine,
    content.school,
    content.educationLine,
    ...content.skills,
    ...content.strengths,
    ...content.projects.flatMap((project) => [project.title, project.organization, project.period, project.role, ...project.details, project.result]),
    "个人简历教育经历项目经历核心技能个人优势成果",
  ].join("");
  const chunkIds = requiredFontChunks(allText);
  const chunkBuffers = await Promise.all(chunkIds.map((chunk) => readFile(path.join(FONT_DIR, `noto-sans-sc-${chunk}-400-normal.woff`))));

  const document = new PDFDocument({
    size: "LETTER",
    margins: { top: MARGIN_TOP, right: MARGIN_X, bottom: MARGIN_BOTTOM, left: MARGIN_X },
    bufferPages: true,
    info: {
      Title: `${content.name || "个人"}简历`,
      Author: "职航",
      Subject: "由职航 Career Profile 生成的 PDF 简历",
      Creator: "职航",
    },
  });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  for (const [index, chunk] of chunkIds.entries()) document.registerFont(`Noto-${chunk}`, chunkBuffers[index]);

  const contentWidth = document.page.width - MARGIN_X * 2;
  const bottomLimit = document.page.height - MARGIN_BOTTOM;
  let y = MARGIN_TOP;

  function fontFor(character: string, bold: boolean) {
    const chunk = fontChunkFor(character);
    if (chunk) return `Noto-${chunk}`;
    return bold ? "Helvetica-Bold" : "Helvetica";
  }

  function printableCharacter(character: string) {
    return fontChunkFor(character) || BUILTIN_CHARACTERS.test(character) ? character : "?";
  }

  function glyphFor(character: string, size: number, bold: boolean): Glyph {
    const printable = printableCharacter(character);
    const font = fontFor(printable, bold);
    document.font(font).fontSize(size);
    return { character: printable, font, width: document.widthOfString(printable) };
  }

  function layoutLines(value: string, size: number, bold: boolean, maxWidth: number) {
    const lines: TextLine[] = [];
    let current: TextLine = { glyphs: [], width: 0 };
    for (const character of Array.from(value)) {
      const glyph = glyphFor(character, size, bold);
      if (current.glyphs.length && current.width + glyph.width > maxWidth) {
        lines.push(current);
        current = { glyphs: [], width: 0 };
      }
      current.glyphs.push(glyph);
      current.width += glyph.width;
    }
    if (current.glyphs.length) lines.push(current);
    return lines.length ? lines : [{ glyphs: [], width: 0 }];
  }

  function addPage() {
    document.addPage();
    y = MARGIN_TOP;
  }

  function ensureSpace(height: number) {
    if (y + height > bottomLimit) addPage();
  }

  function drawLine(line: TextLine, x: number, size: number, color: string) {
    let cursorX = x;
    let run = "";
    let runFont = "";
    let runWidth = 0;
    const flush = () => {
      if (!run) return;
      document.font(runFont).fontSize(size).fillColor(color).text(run, cursorX, y, { lineBreak: false });
      cursorX += runWidth;
      run = "";
      runWidth = 0;
    };
    for (const glyph of line.glyphs) {
      if (runFont && runFont !== glyph.font) flush();
      runFont = glyph.font;
      run += glyph.character;
      runWidth += glyph.width;
    }
    flush();
  }

  function paragraph(value: string, options: { bold?: boolean; size?: number; color?: string; indent?: number; gap?: number; leading?: number; align?: "left" | "center" } = {}) {
    const size = options.size ?? 9.5;
    const bold = options.bold ?? false;
    const indent = options.indent ?? 0;
    const leading = options.leading ?? size * 1.55;
    const maxWidth = contentWidth - indent;
    const lines = layoutLines(value, size, bold, maxWidth);
    for (const line of lines) {
      ensureSpace(leading);
      const alignmentOffset = options.align === "center" ? (maxWidth - line.width) / 2 : 0;
      drawLine(line, MARGIN_X + indent + alignmentOffset, size, options.color ?? INK);
      y += leading;
    }
    y += options.gap ?? 0;
  }

  function section(title: string, english: string) {
    ensureSpace(42);
    y += 15;
    const titleLine = layoutLines(title, 11.5, true, contentWidth)[0];
    drawLine(titleLine, MARGIN_X, 11.5, INK);
    const englishLine = layoutLines(english, 7.5, true, contentWidth)[0];
    drawLine(englishLine, MARGIN_X + titleLine.width + 8, 7.5, "#94a3b0");
    y += 19;
  }

  paragraph(content.name || "个人简历", { bold: true, size: 22, align: "center", leading: 29 });
  const headline = [content.targetRole, content.contactLine].filter(Boolean).join("  ·  ");
  if (headline) paragraph(headline, { size: 9.5, color: ACCENT, align: "center", leading: 16 });

  if (content.school || content.educationLine) {
    section("教育经历", "EDUCATION");
    paragraph([content.school, content.educationLine].filter(Boolean).join("  ·  "), { bold: Boolean(content.school), size: 10.5, gap: 1 });
  }

  if (content.projects.length) {
    section("项目经历", "PROJECT EXPERIENCE");
    for (const [index, project] of content.projects.entries()) {
      if (index) y += 6;
      if (project.title) paragraph(project.title, { bold: true, size: 10.5, gap: 1 });
      const metadata = [project.organization, project.role, project.period].filter(Boolean).join(" · ");
      if (metadata) paragraph(metadata, { size: 8.8, color: MUTED, gap: 3 });
      for (const detail of project.details) paragraph(`• ${detail}`, { size: 9.5, color: MUTED, indent: 3, gap: 1 });
      if (project.result) paragraph(`• 成果：${project.result}`, { size: 9.5, color: MUTED, indent: 3, gap: 1 });
    }
  }

  if (content.skills.length) {
    section("核心技能", "SKILLS");
    paragraph(content.skills.join("  ·  "), { size: 9.5, color: MUTED });
  }

  if (content.strengths.length) {
    section("个人优势", "STRENGTHS");
    for (const strength of content.strengths) paragraph(`• ${strength}`, { size: 9.5, color: MUTED, indent: 3, gap: 1 });
  }

  const pageRange = document.bufferedPageRange();
  for (let index = 0; index < pageRange.count; index += 1) {
    document.switchToPage(pageRange.start + index);
    const originalBottomMargin = document.page.margins.bottom;
    document.page.margins.bottom = 0;
    document.font("Helvetica").fontSize(7.5).fillColor("#9eaab5").text(
      `${index + 1} / ${pageRange.count}`,
      MARGIN_X,
      document.page.height - 28,
      { width: contentWidth, align: "center", lineBreak: false },
    );
    document.page.margins.bottom = originalBottomMargin;
  }
  document.end();
  return completed;
}
