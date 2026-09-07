"use client";

import { ArrowLeft, Check, ChevronDown, FileText, MessageCircleMore, Pencil, RefreshCw, Send, Sparkles, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { ResumeChatBuilder } from "@/components/resume-chat-builder";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { runAgent, type AgentMeta } from "@/lib/agent-client";
import { careerProfileToResumeDraft, saveCareerProfile } from "@/lib/career-profile-store";
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
  const selectedJob = jobs.find((item) => item.id === params.get("job")) ?? jobs[0];
  const profile = useCareerProfile();
  const [resumeOverride, setResumeOverride] = useState<ResumeDraft | null>(null);
  const resume = resumeOverride || careerProfileToResumeDraft(profile);
  const [projectTextOverride, setProjectTextOverride] = useState<string | null>(null);
  const projectText = projectTextOverride ?? resume.projectText;
  const [editing, setEditing] = useState(false);
  const [applied, setApplied] = useState(false);
  const [version, setVersion] = useState(0);
  const [optimizationView, setOptimizationView] = useState<OptimizationView | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationError, setOptimizationError] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(["我已结合目标 JD 完成首轮分析，建议先处理项目经历。"]);
  const [builderOpen, setBuilderOpen] = useState(params.get("mode") === "build");
  const [generated, setGenerated] = useState(false);
  const [activeSection, setActiveSection] = useState("project");
  const [analyses, setAnalyses] = useState<Record<string, JobAnalysisResult>>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const analysisKey = `${selectedJob.id}:${profile.updatedAt}`;
  const analysis = analyses[analysisKey];
  const analysisStatus = analysis
    ? analysis.meta.demo ? "演示引擎已完成分析" : `${analysis.meta.provider} 已完成分析`
    : analysisErrors[analysisKey] || "JD 解析与岗位匹配 Agent 正在分析…";
  const educationParts = resume.education.split("·").map((item) => item.trim());
  const matchScore = analysis?.match.score;
  const jdKeywords = analysis?.jd.keywords.length ? analysis.jd.keywords : selectedJob.tags;
  const optimization = optimizationView?.jobId === selectedJob.id && optimizationView.sourceProfileUpdatedAt === profile.updatedAt
    ? optimizationView.data
    : null;
  const primaryChange = optimization?.changes.find((change) => change.section.includes("项目")) || optimization?.changes[0];
  const improvementCount = optimization?.changes.length || analysis?.match.resumeTips.length || analysis?.match.gaps.length || 0;
  const optimizationReasons = optimization?.changes.map((change) => change.reason).filter(Boolean) || analysis?.match.resumeTips || [];

  useEffect(() => {
    let cancelled = false;
    void runJobAnalysis(selectedJob, profile).then((result) => {
      if (cancelled) return;
      setAnalyses((current) => ({ ...current, [analysisKey]: result }));
    }).catch((error) => {
      if (!cancelled) setAnalysisErrors((current) => ({ ...current, [analysisKey]: error instanceof Error ? error.message : "岗位分析失败" }));
    });
    return () => { cancelled = true; };
  }, [analysisKey, profile, selectedJob]);

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
    saveCareerProfile(nextProfile);
    setResumeOverride(nextDraft);
    setProjectTextOverride(nextDraft.projectText);
    setOptimizationView((current) => current ? { ...current, sourceProfileUpdatedAt: nextProfile.updatedAt } : current);
    setApplied(true);
    setEditing(false);
    setMessages((current) => [...current, "简历优化 Agent：优化版本已保存到 Career Profile，岗位匹配正在重新计算。。"]);
  }

  function sendMessage() {
    const value = message.trim();
    if (!value) return;
    setMessages((current) => [...current, `你：${value}`, "AI：可以。我会保留真实经历，只强化与岗位相关的动作和结果。"]);
    setMessage("");
  }

  function applyGeneratedResume(draft: ResumeDraft, profile: CareerProfile) {
    saveCareerProfile(profile);
    setResumeOverride(draft);
    setProjectTextOverride(draft.projectText);
    setEditing(false);
    setApplied(false);
    setOptimizationView(null);
    setOptimizationError("");
    setGenerated(true);
    setBuilderOpen(false);
    setMessages(["Career Profile 已保存并应用到简历，岗位匹配 Agent 正在重新分析。"]);
  }

  function scrollToSection(section: string) {
    setActiveSection(section);
    document.getElementById(`resume-${section}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <AppShell>
      <header className="workspace-header">
        <div><Link href="/jobs"><ArrowLeft size={15} />返回岗位</Link><p className="eyebrow">AI RESUME STUDIO</p><h1>针对岗位优化简历</h1></div>
        <div className="workspace-save"><span><i />{applied ? "优化版本已应用" : generated ? "对话草稿已应用" : "已自动保存"}</span><button className="secondary-button" onClick={() => window.print()}>导出预览</button></div>
      </header>

      {generated || applied ? <p className="page-feedback" role="status"><Check size={13} />{applied ? "定向优化结果已写入 Career Profile，岗位匹配正在自动更新" : "对话内容已整理为结构化简历，你仍可手动修改或继续 AI 优化"}</p> : null}

      <section className="ai-workbench">
        <aside className="task-rail">
          <p className="panel-label">CURRENT TASK</p>
          <div className="target-job-mini"><span className="company-mark">{selectedJob.initials}</span><div><small>{selectedJob.company}</small><b>{selectedJob.role}</b></div></div>
          <div className="match-up"><span>当前匹配度</span><strong>{matchScore === undefined ? "—" : matchScore}{matchScore === undefined ? null : <small>%</small>}</strong></div>
          <div className="keyword-block"><p>JD 关键词 <span>{jdKeywords.length}</span></p>{jdKeywords.slice(0, 8).map((tag, index) => <span key={`${tag}-${index}`} className={index > 3 ? "weak" : ""}>{tag}</span>)}</div>
          <button className="builder-launch" onClick={() => setBuilderOpen(true)}><Sparkles size={15} /><span><b>对话生成简历</b><small>回答 6 个问题即可</small></span></button>
          <nav className="resume-outline"><p className="panel-label">RESUME OUTLINE</p><button className={activeSection === "profile" ? "active" : ""} onClick={() => scrollToSection("profile")}><span>01</span>个人信息<Check size={13} /></button><button className={activeSection === "education" ? "active" : ""} onClick={() => scrollToSection("education")}><span>02</span>教育经历<Check size={13} /></button><button className={activeSection === "project" ? "active" : ""} onClick={() => scrollToSection("project")}><span>03</span>项目经历<i>2</i></button><button className={activeSection === "skills" ? "active" : ""} onClick={() => scrollToSection("skills")}><span>04</span>技能清单<i>1</i></button></nav>
        </aside>

        <article className="resume-editor">
          <div className="editor-toolbar"><div><FileText size={16} /><span>{resume.name}_{resume.targetRole.split("/")[0].trim()}简历</span></div><button aria-label="简历语言">中文 <ChevronDown size={13} /></button></div>
          <div className="resume-paper">
            <header id="resume-profile"><div><h2>{resume.name}</h2><p>{resume.education}</p></div><span>{resume.targetRole}</span></header>
            <section id="resume-education"><h3>教育经历 <small>EDUCATION</small></h3><div className="resume-row"><b>{educationParts[0] || resume.education}</b><span>{educationParts.slice(1).join(" · ") || "在读"}</span><time>在读</time></div><p>主修：用户研究、交互设计、数据分析基础、产品创新方法</p></section>
            <section id="resume-project" className="highlight-section"><h3>项目经历 <small>PROJECT EXPERIENCE</small></h3><div className="resume-row"><b>{resume.projectName}</b><span>核心成员</span><time>近期项目</time></div>
              {editing ? <textarea aria-label="手动编辑项目经历" value={projectText} onChange={(event) => setProjectTextOverride(event.target.value)} autoFocus /> : <p className={applied ? "applied-copy" : ""}>{projectText}</p>}
              <div className="inline-ai-tag"><WandSparkles size={13} />AI 建议聚焦此段</div>
            </section>
            <section><div className="resume-row"><b>校园创新项目 · 智能课程助手</b><span>产品设计</span><time>2025.09 — 2026.01</time></div><p>完成 18 名学生访谈，梳理核心场景并输出高保真原型，推动团队完成可用性测试。</p></section>
            <section id="resume-skills"><h3>技能清单 <small>SKILLS</small></h3><p>{resume.skills.join(" / ")}</p></section>
          </div>
        </article>

        <aside className="ai-copilot">
          <div className="copilot-head"><div><span><Sparkles size={16} /></span><p><b>AI 求职助手</b><small>{analysisStatus}</small></p></div><button aria-label="更多">•••</button></div>
          <div className="analysis-status"><span>发现 {improvementCount} 个可提升点</span><b>{optimization ? optimization.safeToApply ? "事实检查通过" : "需要事实确认" : "等待生成"}</b></div>
          <div className="suggestion-card">
            <p className="panel-label">PROJECT EXPERIENCE</p><h3>{optimization?.headline || "生成岗位定向优化版本"}</h3><p>{optimizationError || optimization?.summary || (analysis ? "简历优化 Agent 会结合共享档案、结构化 JD 与匹配差距，只改写已有事实。" : "正在等待 JD 与岗位匹配分析完成。")}</p>
            <div className="rewrite-block"><span>AI 建议 · 版本 {Math.max(version, 1)}</span><p>{optimizing ? "简历优化 Agent 正在进行事实核验与定向改写…" : primaryChange?.after || "点击下方按钮生成优化版本；未生成前不会改动 Career Profile。"}</p></div>
            <div className="why-list"><span>{optimization ? "为什么这样修改？" : "本次优化重点"}</span>{optimizationReasons.slice(0, 3).map((reason, index) => <p key={`${reason}-${index}`}><Check size={12} />{reason}</p>)}</div>
            {optimization?.factWarnings.length ? <div className="fact-warning-list"><b>需要确认的事实</b>{optimization.factWarnings.map((warning, index) => <p key={`${warning}-${index}`}>{warning}</p>)}</div> : null}
            <button className={`primary-button full ${applied ? "applied" : ""}`} onClick={optimization ? applySuggestion : () => void generateOptimization()} disabled={optimizing || !analysis || applied || Boolean(optimization && !optimization.safeToApply)}>{optimizing ? <><RefreshCw size={15} className="spin" />正在生成…</> : applied ? <><Check size={15} />已应用并保存</> : optimization ? optimization.safeToApply ? <><WandSparkles size={15} />应用安全版本</> : <><WandSparkles size={15} />请先确认事实</> : <><WandSparkles size={15} />生成优化版本</>}</button>
            <div className="suggestion-actions"><button onClick={() => void generateOptimization()} disabled={!analysis || optimizing}><RefreshCw size={14} className={optimizing ? "spin" : ""} />重新生成</button><button onClick={() => setEditing(true)}><Pencil size={14} />手动编辑</button></div>
          </div>
          <div className="chat-area"><div className="chat-messages">{messages.slice(-3).map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}</div><div className="chat-input"><input aria-label="向 AI 提问" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="问问为什么这样修改…" /><button onClick={sendMessage} aria-label="发送消息"><Send size={15} /></button></div><span><MessageCircleMore size={12} />简历、JD、匹配与定向优化已接入 Agent；本区自由对话仍为演示</span></div>
        </aside>
      </section>
      {builderOpen ? <ResumeChatBuilder onClose={() => setBuilderOpen(false)} onApply={applyGeneratedResume} /> : null}
    </AppShell>
  );
}
