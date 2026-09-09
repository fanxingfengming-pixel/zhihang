import { z } from "zod";
import { buildResumeFilename, hasResumeExportContent } from "@/lib/resume-export/content";
import { generateResumeDocx } from "@/lib/resume-export/docx";
import { generateResumePdf } from "@/lib/resume-export/pdf";
import { CareerProfileSchema } from "@/lib/schemas";
import {
  privateJson,
  protectMutation,
  readJsonWithLimit,
  RequestSecurityError,
  requestSecurityError,
} from "@/lib/request-security";

export const runtime = "nodejs";

const ResumeExportRequestSchema = z.object({
  format: z.enum(["pdf", "docx"]),
  profile: CareerProfileSchema,
}).strict();

export async function POST(request: Request) {
  try {
    protectMutation(request, "resume-export", { limit: 12 });
    const payload = ResumeExportRequestSchema.safeParse(await readJsonWithLimit(request, 256 * 1024));
    if (!payload.success) return privateJson({ error: "导出参数无效，请刷新页面后重试。" }, { status: 400 });
    if (!hasResumeExportContent(payload.data.profile)) {
      return privateJson({ error: "请先填写姓名、教育、技能或项目经历，再导出简历。" }, { status: 422 });
    }

    const { format, profile } = payload.data;
    const filename = buildResumeFilename(profile, format);
    const bytes = format === "pdf"
      ? await generateResumePdf(profile)
      : await generateResumeDocx(profile);
    const contentType = format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="resume.${format}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityError(error);
    return privateJson({ error: "简历文件生成失败，请稍后重试。" }, { status: 500 });
  }
}
