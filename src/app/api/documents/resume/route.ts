import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { privateJson, protectMutation, RequestSecurityError, requestSecurityError } from "@/lib/request-security";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 50_000;

function extensionOf(name: string) {
  return name.toLowerCase().split(".").pop() || "";
}

export async function POST(request: Request) {
  try {
    protectMutation(request, "resume-import", { limit: 10 });
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_FILE_SIZE + 256 * 1024) {
      throw new RequestSecurityError("上传请求不能超过 5.25MB。", 413);
    }
    const formData = await request.formData();
    const uploaded = formData.get("file");
    if (!(uploaded instanceof File)) return privateJson({ error: "请选择要导入的简历文件" }, { status: 400 });
    if (uploaded.size === 0) return privateJson({ error: "文件内容为空" }, { status: 400 });
    if (uploaded.size > MAX_FILE_SIZE) return privateJson({ error: "文件不能超过 5MB" }, { status: 413 });

    const extension = extensionOf(uploaded.name);
    if (!["pdf", "docx", "txt", "md"].includes(extension)) {
      return privateJson({ error: "仅支持 PDF、DOCX、TXT 和 Markdown 文件" }, { status: 415 });
    }

    const bytes = await uploaded.arrayBuffer();
    let text = "";
    const warnings: string[] = [];

    if (extension === "pdf") {
      const parser = new PDFParse({ data: new Uint8Array(bytes) });
      try {
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
      if (text.trim().length < 30) warnings.push("PDF 可提取文本较少，扫描版简历暂不支持 OCR，请改用 DOCX 或文本格式。 ");
    } else if (extension === "docx") {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      text = result.value;
      if (result.messages.length) warnings.push("DOCX 中有部分格式无法转换，已仅提取可识别的文字内容。");
    } else {
      text = new TextDecoder("utf-8").decode(bytes);
    }

    const cleaned = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
    if (!cleaned) return privateJson({ error: "没有从文件中提取到文字，请检查文件是否加密或为扫描图片" }, { status: 422 });
    const truncated = cleaned.length > MAX_TEXT_LENGTH;
    if (truncated) warnings.push("文件文字较长，本次仅保留前 50,000 个字符。 ");

    return privateJson({
      fileName: uploaded.name,
      fileType: extension,
      text: cleaned.slice(0, MAX_TEXT_LENGTH),
      characterCount: Math.min(cleaned.length, MAX_TEXT_LENGTH),
      warnings,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityError(error);
    return privateJson({ error: "简历文件解析失败，请确认文件未加密且格式有效。" }, { status: 500 });
  }
}
