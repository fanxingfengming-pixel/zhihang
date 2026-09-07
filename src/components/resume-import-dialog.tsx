"use client";

import { Check, FileText, RefreshCw, Sparkles, Upload, X } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { runAgent, type AgentMeta } from "@/lib/agent-client";
import { DEFAULT_CAREER_PROFILE, loadCareerProfile } from "@/lib/career-profile-store";
import type { CareerProfile } from "@/lib/schemas";

type ExtractedResume = {
  fileName: string;
  fileType: string;
  text: string;
  characterCount: number;
  warnings: string[];
};

export function ResumeImportDialog({ onClose, onApply }: { onClose: () => void; onApply: (profile: CareerProfile) => void }) {
  const [extracted, setExtracted] = useState<ExtractedResume | null>(null);
  const [profilePreview, setProfilePreview] = useState<{ profile: CareerProfile; meta: AgentMeta } | null>(null);
  const [loading, setLoading] = useState<"extract" | "profile" | null>(null);
  const [error, setError] = useState("");

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading("extract");
    setError("");
    setExtracted(null);
    setProfilePreview(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/documents/resume", { method: "POST", body });
      const payload = await response.json() as ExtractedResume & { error?: string };
      if (!response.ok) throw new Error(payload.error || "文件解析失败");
      setExtracted(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "文件解析失败");
    } finally {
      setLoading(null);
      event.target.value = "";
    }
  }

  async function buildProfile() {
    if (!extracted || loading) return;
    setLoading("profile");
    setError("");
    try {
      const response = await runAgent<CareerProfile>("resume", {
        resumeText: extracted.text,
        sourceFileName: extracted.fileName,
      }, { currentProfile: loadCareerProfile() || DEFAULT_CAREER_PROFILE });
      setProfilePreview({ profile: response.data, meta: response.meta });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "简历结构化失败");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="resume-import-dialog" role="dialog" aria-modal="true" aria-labelledby="resume-import-title">
        <header><div><span><Upload size={17} /></span><p><small>REAL RESUME IMPORT</small><b id="resume-import-title">导入已有简历</b></p></div><button onClick={onClose} aria-label="关闭简历导入"><X size={18} /></button></header>
        <div className="resume-import-body">
          <label className="resume-dropzone">
            {loading === "extract" ? <RefreshCw size={25} className="spin" /> : <FileText size={25} />}
            <b>{loading === "extract" ? "正在提取文件文字…" : "选择 PDF、DOCX、TXT 或 Markdown"}</b>
            <span>文件最大 5MB；扫描版 PDF 暂不支持 OCR</span>
            <input type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={(event) => void chooseFile(event)} disabled={Boolean(loading)} />
          </label>
          {error ? <p className="resume-import-error" role="alert">{error}</p> : null}
          {extracted ? <div className="resume-extracted"><div><FileText size={16} /><p><b>{extracted.fileName}</b><small>{extracted.fileType.toUpperCase()} · 已提取 {extracted.characterCount.toLocaleString("zh-CN")} 字符</small></p></div>{extracted.warnings.map((warning) => <p key={warning}>{warning}</p>)}<textarea aria-label="提取出的简历文字" value={extracted.text} readOnly /></div> : null}
          {profilePreview ? <div className="resume-profile-preview"><div><span>{profilePreview.profile.basics.name.slice(0, 1) || "简"}</span><p><b>{profilePreview.profile.basics.name || "姓名待确认"}</b><small>{[profilePreview.profile.basics.school, profilePreview.profile.basics.major, profilePreview.profile.basics.grade].filter(Boolean).join(" · ") || "教育信息待确认"}</small></p></div><dl><div><dt>目标方向</dt><dd>{profilePreview.profile.basics.targetRole || "待确认"}</dd></div><div><dt>技能</dt><dd>{profilePreview.profile.skills.join(" / ") || "待确认"}</dd></div><div><dt>项目</dt><dd>{profilePreview.profile.projects.map((project) => project.title).join(" / ") || "待确认"}</dd></div></dl><small>由 {profilePreview.meta.demo ? "演示引擎" : profilePreview.meta.provider} 结构化；保存前请核对所有信息。</small></div> : null}
        </div>
        <footer><button className="secondary-button" onClick={onClose}>取消</button>{profilePreview ? <button className="primary-button" onClick={() => onApply(profilePreview.profile)}><Check size={15} />确认并保存档案</button> : <button className="primary-button" onClick={() => void buildProfile()} disabled={!extracted || Boolean(loading)}>{loading === "profile" ? <><RefreshCw size={15} className="spin" />Agent 正在整理…</> : <><Sparkles size={15} />交给简历 Agent 整理</>}</button>}</footer>
      </section>
    </div>
  );
}
