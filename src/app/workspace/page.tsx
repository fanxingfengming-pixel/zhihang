"use client";

import { ArrowLeft, Check, ChevronDown, FileText, MessageCircleMore, Pencil, RefreshCw, Save, Send, Sparkles, Upload, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { ResumeChatBuilder } from "@/components/resume-chat-builder";
import { ResumeImportDialog } from "@/components/resume-import-dialog";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { useCustomJobs } from "@/hooks/use-custom-jobs";
import { useJobAnalysis } from "@/hooks/use-job-analysis";
import { runAgent, type AgentMeta } from "@/lib/agent-client";
import { careerProfileToMarkdown, careerProfileToResumeDraft, saveCareerProfile } from "@/lib/career-profile-store";
import { runJobAnalysis, type JobAnalysisResult } from "@/lib/job-analysis";
import { jobs } from "@/lib/ui-data";
import type { ResumeDraft } from "@/lib/resume-draft";
import type { CareerProfile, ResumeOptimization } from "@/lib/schemas";

type OptimizationView = {
  data: ResumeOptimization;
  meta: AgentMeta;
  jobId: string;
  sourceProfileUpdatedAt: string;
};

export default function WorkspacePage() {
  return <Suspense fallback={<div className="route-loading">正在准备 AI 工作区…</div>}><WorkspaceContent /></Suspense>;
}

function WorkspaceContent() {
  const params = useSearchParams();
  const customJobs = useCustomJobs();
  const selectedJob = [...customJobs, ...jobs].find((item) => item.id === params.get("job")) ?? jobs[0];
  const profile = useCareerProfile();
  const [resumeOverride, setResumeOverride] = useState<ResumeDraft | null>(null);
  const resume = resumeOverride || careerProfileToResumeDraft(profile);
  const [projectTextOverride, setProjectTextOverride] = useState<string | null>(null);
  const projectText = projectTextOverride ?? resume.projectText;
  const [editing, setEditing] = useState(false);
  const [manualSaveState, setManualSaveState] = useState<"idle" | "dirty" | "saved" | "error">("idle");
  const [applied, setApplied] = useState(false);
  const [version, setVersion] = useState(0);
  const [optimizationView, setOptimizationView] = useState<OptimizationView | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationError, setOptimizationError] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(["选择目标岗位并运行分析后，我会给出有证据的优化建议。"]);
  const [builderOpen, setBuilderOpen] = useState(params.get("mode") === "build");
  const [importOpen, setImportOpen] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [activeSection, setActiveSection] = useState("project");
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [transientAnalysis, setTransientAnalysis] = useState<JobAnalysisResult | null>(null);
  const analysisKey = `${selectedJob.id}:${profile.updatedAt}`;
  const cachedAnalysis = useJobAnalysis(selectedJob.id, profile.updatedAt);
  const analysis = transientAnalysis?.jobId === selectedJob.id && transientAnalysis.profileUpdatedAt === profile.updatedAt
    ? transientAnalysis
    : cachedAnalysis;
  const analysisStatus = analysis
    ? analysis.meta.demo ? "演示引擎已完成分析" : `${analysis.meta.provider} 已完成分析`
    : analysisErrors[analysisKey] || "尚未运行岗位分析";
  const primaryProject = profile.projects[0];
  const matchScore = analysis?.match.score;
  const jdKeywords = analysis?.jd.keywords.length ? analysis.jd.keywords : selectedJob.tags;
  const optimization = optimizationView?.jobId === selectedJob.id && optimizationView.sourceProfileUpdatedAt === profile.updatedAt
    ? optimizationView.data
    : null;
  const primaryChange = optimization?.changes.find((change) => change.section.includes("项目")) || optimization?.changes[0];
  const improvementCount = optimization?.changes.length || analysis?.match.resumeTips.length || analysis?.match.gaps.length || 0;
  const optimizationReasons = optimization?.changes.map((change) => change.reason).filter(Boolean) || analysis?.match.resumeTips || [];

  async function analyzeSelectedJob(force = false) {
    if (analysisLoading) return;
    setAnalysisLoading(true);
    setAnalysisErrors((current) => ({ ...current, [analysisKey]: "" }));
    try {
      setTransientAnalysis(await runJobAnalysis(selectedJob, profile, force));
    } catch (error) {
      setAnalysisErrors((current) => ({ ...current, [analysisKey]: error instanceof Error ? error.message : "岗位分析失败" }));
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function generateOptimization() {
    if (!analysis || optimizing) return;
    setOptimizing(true);
    setOptimizationError("");
    setApplied(false);
    try {
      const response = await runAgent<ResumeOptimization>("optimize", {
        profile,
        currentResumeText: projectText,
        targetSection: "项目经历",
      }, { jd: analysis.jd, match: analysis.match });
      setVersion((value) => value + 1);
      setOptimizationView({
        data: response.data,
        meta: response.meta,
        jobId: selectedJob.id,
        sourceProfileUpdatedAt: profile.updatedAt,
      });
      setMessages((current) => [...current, `简历优化 Agent：已由${response.meta.demo ? "演示引擎" : response.meta.provider}生成定向版本。`]);
    } catch (error) {
      setOptimizationError(error instanceof Error ? error.message : "简历优化失败");
    } finally {
      setOptimizing(false);
    }
  }

  function applySuggestion() {
    if (!optimization || !optimization.safeToApply) return;
    const nextProfile = optimization.optimizedProfile;
    const nextDraft = careerProfileToResumeDraft(nextProfile);
    if (!saveCareerProfile(nextProfile)) {
      setOptimizationError("浏览器无法保存优化版本，请检查存储权限后重试。");
      return;
    }
    setResumeOverride(nextDraft);
    setProjectTextOverride(nextDraft.projectText);
    setOptimizationView((current) => current ? { ...current, sourceProfileUpdatedAt: nextProfile.updatedAt } : current);
    setApplied(true);
    setEditing(false);
    setMessages((current) => [...current, "简历优化 Agent：优化版本已保存到 Career Profile，可重新运行岗位分析查看新匹配度。"]);
  }

  function sendMessage() {
    const value = message.trim();
    if (!value) return;
    setMessages((current) => [...current, `你：${value}`, "AI：可以。我会保留真实经历，只强化与岗位相关的动作和结果。"]);
    setMessage("");
  }

  function applyGeneratedResume(draft: ResumeDraft, profile: CareerProfile) {
    if (!saveCareerProfile(profile)) {
      setMessages((current) => [...current, "保存失败：浏览器存储不可用，请检查隐私模式或剩余空间。"]);
      return;
    }
    setResumeOverride(draft);
    setProjectTextOverride(draft.projectText);
    setEditing(false);
    setApplied(false);
    setOptimizationView(null);
    setOptimizationError("");
    setGenerated(true);
    setBuilderOpen(false);
    setManualSaveState("saved");
    setMessages(["Career Profile 已保存并应用到简历；需要时可点击运行岗位分析。"]);
  }

  function startManualEdit() {
    if (!primaryProject) return;
    setProjectTextOverride(projectText);
    setManualSaveState("idle");
    setEditing(true);
  }

  function cancelManualEdit() {
    setProjectTextOverride(null);
    setManualSaveState("idle");
    setEditing(false);
  }

  function saveManualEdit() {
    const value = projectText.trim();
    if (!primaryProject || !value) return;
    try {
      const nextProfile: CareerProfile = {
        ...profile,
        projects: profile.projects.map((project, index) => index === 0
          ? { ...project, details: [value], result: "" }
          : project),
        resumeMarkdown: "",
        updatedAt: new Date().toISOString(),
      };
      nextProfile.resumeMarkdown = careerProfileToMarkdown(nextProfile);
      if (!saveCareerProfile(nextProfile)) throw new Error("浏览器存储不可用");
      setResumeOverride(careerProfileToResumeDraft(nextProfile));
      setProjectTextOverride(value);
      setManualSaveState("saved");
      setEditing(false);
      setMessages((current) => [...current, "手动修改已保存到 Career Profile。"]);
    } catch {
      setManualSaveState("error");
    }
  }

  function scrollToSection(section: string) {
    setActiveSection(section);
    document.getElementById(`resume-${section}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <AppShell>
      <header className="workspace-header">
        <div><Link href="/jobs"><ArrowLeft size={15} />返回岗位</Link><p className="eyebrow">AI RESUME STUDIO</p><h1>针对岗位优化简历</h1></div>
        <div className="workspace-save"><span><i />{manualSaveState === "dirty" ? "手动修改尚未保存" : manualSaveState === "error" ? "保存失败，请重试" : manualSaveState === "saved" ? "手动修改已保存" : applied ? "优化版本已应用" : generated ? "对话草稿已应用" : profile.updatedAt ? "Career Profile 已同步" : "尚未建立求职档案"}</span><button className="secondary-button" onClick={() => window.print()}>导出预览</button></div>
      </header>

      {generated || applied ? <p className="page-feedback" role="status"><Check size={13} />{applied ? "定向优化结果已写入 Career Profile，岗位匹配正在自动更新" : "对话内容已整理为结构化简历，你仍可手动修改或继续 AI 优化"}</p> : null}

      <section className="ai-workbench">
        <aside className="task-rail">
          <p className="panel-label">CURRENT TASK</p>
          <div className="target-job-mini"><span className="company-mark">{selectedJob.initials}</span><div><small>{selectedJob.company}</small><b>{selectedJob.role}</b></div></div>
          <div className="match-up"><span>当前匹配度</span><strong>{matchScore === undefined ? "—" : matchScore}{matchScore === undefined ? null : <small>%</small>}</strong></div>
          <div className="keyword-block"><p>JD 关键词 <span>{jdKeywords.length}</span></p>{jdKeywords.slice(0, 8).map((tag, index) => <span key={`${tag}-${index}`} className={index > 3 ? "weak" : ""}>{tag}</span>)}</div>
          <button className="builder-launch" onClick={() => setBuilderOpen(true)}><Sparkles size={15} /><span><b>对话生成简历</b><small>回答 6 个问题即可</small></span></button>
          <button className="builder-launch resume-import-launch" onClick={() => setImportOpen(true)}><Upload size={15} /><span><b>导入已有简历</b><small>支持 PDF / DOCX / TXT</small></span></button>
          <nav className="resume-outline"><p className="panel-label">RESUME OUTLINE</p><button className={activeSection === "profile" ? "active" : ""} onClick={() => scrollToSection("profile")}><span>01</span>个人信息{profile.basics.name ? <Check size={13} /> : null}</button><button className={activeSection === "education" ? "active" : ""} onClick={() => scrollToSection("education")}><span>02</span>教育经历{profile.basics.school ? <Check size={13} /> : null}</button><button className={activeSection === "project" ? "active" : ""} onClick={() => scrollToSection("project")}><span>03</span>项目经历<i>{profile.projects.length}</i></button><button className={activeSection === "skills" ? "active" : ""} onClick={() => scrollToSection("skills")}><span>04</span>技能清单<i>{profile.skills.length}</i></button></nav>
        </aside>

        <article className="resume-editor">
          <div className="editor-toolbar"><div><FileText size={16} /><span>{resume.name}_{resume.targetRole.split("/")[0].trim()}简历</span></div><button aria-label="简历语言" title="MVP 当前仅支持中文" disabled>中文 <ChevronDown size={13} /></button></div>
          <div className="resume-paper">
            <header id="resume-profile"><div><h2>{resume.name}</h2><p>{resume.education}</p></div><span>{resume.targetRole}</span></header>
            <section id="resume-education"><h3>教育经历 <small>EDUCATION</small></h3><div className="resume-row"><b>{profile.basics.school || "学校待补充"}</b><span>{[profile.basics.major, profile.basics.grade].filter(Boolean).join(" · ") || "专业与年级待补充"}</span><time>{profile.basics.grade}</time></div></section>
            <section id="resume-project" className="highlight-section"><h3>项目经历 <small>PROJECT EXPERIENCE</small></h3><div className="resume-row"><b>{primaryProject?.title || "项目经历待补充"}</b><span>{primaryProject?.role}</span><time>{primaryProject?.period}</time></div>
              {editing ? <textarea aria-label="手动编辑项目经历" value={projectText} onChange={(event) => { setProjectTextOverride(event.target.value); setManualSaveState("dirty"); }} autoFocus /> : <p className={applied ? "applied-copy" : ""}>{projectText}</p>}
              <div className="inline-ai-tag"><WandSparkles size={13} />AI 建议聚焦此段</div>
            </section>
            {profile.projects.slice(1).map((project) => <section key={`${project.title}-${project.period}`}><div className="resume-row"><b>{project.title}</b><span>{project.role}</span><time>{project.period}</time></div><p>{[...project.details, project.result].filter(Boolean).join("；")}</p></section>)}
            <section id="resume-skills"><h3>技能清单 <small>SKILLS</small></h3><p>{resume.skills.join(" / ") || "技能待补充"}</p></section>
          </div>
        </article>

        <aside className="ai-copilot">
          <div className="copilot-head"><div><span><Sparkles size={16} /></span><p><b>AI 求职助手</b><small>{analysisStatus}</small></p></div><button aria-label="更多功能尚未开放" title="更多功能尚未开放" disabled>•••</button></div>
          <div className="analysis-status"><span>发现 {improvementCount} 个可提升点</span><b>{optimization ? optimization.safeToApply ? "事实检查通过" : "需要事实确认" : "等待生成"}</b></div>
          <div className="suggestion-card">
            <p className="panel-label">PROJECT EXPERIENCE</p><h3>{optimization?.headline || "生成岗位定向优化版本"}</h3><p>{optimizationError || optimization?.summary || (analysis ? "简历优化 Agent 会结合共享档案、结构化 JD 与匹配差距，只改写已有事实。" : "先运行岗位分析，再生成有证据的定向优化版本。")}</p>
            <div className="rewrite-block"><span>AI 建议 · 版本 {Math.max(version, 1)}</span><p>{optimizing ? "简历优化 Agent 正在进行事实核验与定向改写…" : primaryChange?.after || "点击下方按钮生成优化版本；未生成前不会改动 Career Profile。"}</p></div>
            <div className="why-list"><span>{optimization ? "为什么这样修改？" : "本次优化重点"}</span>{optimizationReasons.slice(0, 3).map((reason, index) => <p key={`${reason}-${index}`}><Check size={12} />{reason}</p>)}</div>
            {optimization?.factWarnings.length ? <div className="fact-warning-list"><b>需要确认的事实</b>{optimization.factWarnings.map((warning, index) => <p key={`${warning}-${index}`}>{warning}</p>)}</div> : null}
            <button className={`primary-button full ${applied ? "applied" : ""}`} onClick={!analysis ? () => void analyzeSelectedJob() : optimization ? applySuggestion : () => void generateOptimization()} disabled={analysisLoading || optimizing || applied || Boolean(optimization && !optimization.safeToApply)}>{analysisLoading ? <><RefreshCw size={15} className="spin" />正在分析岗位…</> : optimizing ? <><RefreshCw size={15} className="spin" />正在生成…</> : applied ? <><Check size={15} />已应用并保存</> : !analysis ? <><Sparkles size={15} />先运行岗位分析</> : optimization ? optimization.safeToApply ? <><WandSparkles size={15} />应用安全版本</> : <><WandSparkles size={15} />请先确认事实</> : <><WandSparkles size={15} />生成优化版本</>}</button>
            <div className="suggestion-actions">{editing ? <><button onClick={cancelManualEdit}>取消编辑</button><button onClick={saveManualEdit} disabled={!projectText.trim()}><Save size={14} />保存修改</button></> : <><button onClick={() => void generateOptimization()} disabled={!analysis || optimizing}><RefreshCw size={14} className={optimizing ? "spin" : ""} />重新生成</button><button onClick={startManualEdit} disabled={!primaryProject}><Pencil size={14} />手动编辑</button></>}</div>
          </div>
          <div className="chat-area"><div className="chat-messages" aria-live="polite">{messages.slice(-3).map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}</div><div className="chat-input"><input name="workspace-question" aria-label="向 AI 提问" value={message} onChange={(event) => setMessage(event.target.value)} autoComplete="off" onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="问问为什么这样修改…" /><button onClick={sendMessage} aria-label="发送消息"><Send size={15} /></button></div><span><MessageCircleMore size={12} aria-hidden="true" />简历、JD、匹配与定向优化已接入 Agent；本区自由对话仍为演示</span></div>
        </aside>
      </section>
      {builderOpen ? <ResumeChatBuilder onClose={() => setBuilderOpen(false)} onApply={applyGeneratedResume} /> : null}
      {importOpen ? <ResumeImportDialog onClose={() => setImportOpen(false)} onApply={(profile) => { applyGeneratedResume(careerProfileToResumeDraft(profile), profile); setImportOpen(false); }} /> : null}
    </AppShell>
  );
}
