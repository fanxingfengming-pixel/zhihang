import { describe, expect, it } from "vitest";
import { estimateZipUncompressedSize, validateFileSignature } from "@/app/api/documents/resume/route";

describe("简历上传文件边界", () => {
  it("拒绝伪装成 PDF 或 DOCX 的普通文本", () => {
    const bytes = new TextEncoder().encode("not a real document");
    expect(validateFileSignature("pdf", bytes)).toBe(false);
    expect(validateFileSignature("docx", bytes)).toBe(false);
    expect(validateFileSignature("txt", bytes)).toBe(true);
  });

  it("无法读取 ZIP 中央目录时不把文件当作安全 DOCX", () => {
    const incompleteZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    expect(validateFileSignature("docx", incompleteZip)).toBe(true);
    expect(estimateZipUncompressedSize(incompleteZip)).toBeNull();
  });
});
