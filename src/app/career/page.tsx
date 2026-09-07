"use client";

import { ArrowRight, BarChart3, BrainCircuit, BriefcaseBusiness, Check, FileText, Fingerprint, Lightbulb, MapPin, Mic2, RefreshCw, Route, Save, Sparkles, Target, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AppShell, PageHeading, ProgressLine } from "@/components/ui/app-shell";
import { AgentTrace, type AgentTraceStep } from "@/components/ui/agent-trace";
import { saveCareerProfile } from "@/lib/career-profile-store";
import { useApplications } from "@/hooks/use-applications";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { useCareerIntelligenceHistory, useInterviewHistory } from "@/hooks/use-insight-history";
import { runAgent } from "@/lib/agent-client";
import { calculateProfileCompletion } from "@/lib/career-profile-metrics";
import { saveCareerIntelligence } from "@/lib/insight-history-store";
import type { CareerPositioning, GrowthPlan, SkillGapAnalysis } from "@/lib/schemas";

export default function CareerCenterPage() {
  const [editingTarget, setEditingTarget] = useState(false);
  const [saved, setSaved] = useState(false);
  const profile = useCareerProfile();
  const applications = useApplications().filter((item) => !item.notes.includes("示例记录"));
  const interviewHistory = useInterviewHistory();
  const profileCompletion = calculateProfileCompletion(profile);
  const parsedUpdatedAt = Date.parse(profile.updatedAt);
  const profileUpdatedLabel = Number.isNaN(parsedUpdatedAt)
    ? "尚未保存"
    : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Asia/Shanghai" }).format(new Date(parsedUpdatedAt));
  const target = {
    role: profile.basics.targetRole || "AI 产品经理",
    cities: profile.basics.location || "杭州 / 上海",
    industry: "互联网 / AI",
    stage: "2027 暑期实习",
  };
  const [targetDraft, setTargetDraft] = useState(target);
  const storedIntelligence = useCareerIntelligenceHistory();
  const intelligence = storedIntelligence?.profileUpdatedAt === profile.updatedAt ? storedIntelligence : null;
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [intelligenceStage, setIntelligenceStage] = useState<"career" | "gap" | "plan" | null>(null);
  const [intelligenceError, setIntelligenceError] = useState("");
  const journey = [
    { number: "01", title: "职业画像", note: `${profileCompletion}% 完整`, detail: "结合专业、兴趣与项目经历，生成你的求职能力画像。", status: profileCompletion === 100 ? "已完成" : "进行中", icon: Fingerprint, href: "/career" },
    { number: "02", title: "简历构建", note: profile.resumeMarkdown ? "基础简历已生成" : "等待生成基础简历", detail: "通过 6 个简单问题生成草稿，再强化项目成果与岗位关键词。", status: profile.resumeMarkdown ? "已完成" : "可开始", icon: FileText, href: "/workspace?mode=build" },
    { number: "03", title: "岗位匹配", note: "从目标岗位开始分析", detail: "根据职业目标和简历证据，找到更值得投入的机会。", status: "可开始", icon: BriefcaseBusiness, href: "/jobs" },
    { number: "04", title: "投递准备", note: `${applications.length} 条真实投递记录`, detail: "为目标岗位定制简历、求职信与投递节奏。", status: applications.length ? "进行中" : "可开始", icon: Target, href: "/workspace" },
    { number: "05", title: "面试训练", note: `${interviewHistory.length} 次练习`, detail: "围绕岗位能力模型进行模拟问答与表达复盘。", status: interviewHistory.length ? "进行中" : "可开始", icon: Mic2, href: "/interview" },
    { number: "06", title: "投递与 Offer", note: `${applications.filter((item) => item.stage === "offer").length} 个已记录 Offer`, detail: "跟踪每次投递的下一步，并在信息核实后比较 Offer。", status: applications.some((item) => item.stage === "offer") ? "进行中" : "可开始", icon: BriefcaseBusiness, href: "/applications" },
  ];
  const completedJourneySteps = journey.filter((item) => item.status === "已完成").length;

  function openTargetEditor() {
    setTargetDraft(target);
    setEditingTarget(true);
  }

  function saveTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProfile = {
      ...profile,
      basics: { ...profile.basics, targetRole: targetDraft.role, location: targetDraft.cities },
      updatedAt: new Date().toISOString(),
    };
    saveCareerProfile(nextProfile);
    setEditingTarget(false);
    setSaved(true);
  }

  async function generateCareerIntelligence() {
    if (intelligenceLoading) return;
    setIntelligenceLoading(true);
    setIntelligenceError("");
    try {
      setIntelligenceStage("career");
      const positioning = await runAgent<CareerPositioning>("career", { profile });
      setIntelligenceStage("gap");
      const gap = await runAgent<SkillGapAnalysis>("gap", { profile }, { career: positioning.data });
      setIntelligenceStage("plan");
      const plan = await runAgent<GrowthPlan>("plan", { profile }, { career: positioning.data, gap: gap.data });
      saveCareerIntelligence({
        profileUpdatedAt: profile.updatedAt,
        generatedAt: new Date().toISOString(),
        positioning: positioning.data,
        gap: gap.data,
        plan: plan.data,
        meta: plan.meta,
      });
    } catch (error) {
      setIntelligenceError(error instanceof Error ? error.message : "职业智能报告生成失败");
    } finally {
      setIntelligenceLoading(false);
      setIntelligenceStage(null);
    }
  }

  const intelligenceSteps: AgentTraceStep[] = [
    { id: "career", label: "职业定位 Agent", description: "提出岗位方向与验证实验", source: "Career Profile", status: intelligence ? "completed" : intelligenceStage === "career" ? "running" : intelligenceStage ? "completed" : "waiting" },
    { id: "gap", label: "能力诊断 Agent", description: "区分证据、优势和关键差距", source: "Career Profile + 定位结果", status: intelligence ? "completed" : intelligenceStage === "gap" ? "running" : intelligenceStage === "plan" ? "completed" : "waiting" },
    { id: "plan", label: "提升计划 Agent", description: "生成任务、交付物与验收标准", source: "能力差距 + 优先级", status: intelligence ? "completed" : intelligenceStage === "plan" ? "running" : "waiting" },
  ];

  return (
    <AppShell>
      <PageHeading eyebrow="CAREER JOURNEY" title="求职中心" description="不是完成一组工具，而是走完一条属于你的求职成长路径。" action={<button className="secondary-button" onClick={openTargetEditor}>调整求职目标</button>} />
      <section className="career-overview">
        <article className="target-card">
          <div className="target-card-head"><div><p className="eyebrow">MY DESTINATION</p><h2>你的求职目标</h2></div><span className="target-stamp">{saved ? "刚刚更新" : "已确认"}</span></div>
          <div className="target-main"><span className="target-icon"><Target size={25} /></span><div><small>目标岗位</small><strong>{target.role}</strong></div></div>
          <div className="target-details">
            <div><MapPin size={16} /><span>目标城市</span><b>{target.cities}</b></div>
            <div><BriefcaseBusiness size={16} /><span>目标行业</span><b>{target.industry}</b></div>
            <div><Sparkles size={16} /><span>求职阶段</span><b>{target.stage}</b></div>
          </div>
        </article>
        <article className="growth-card">
          <div className="growth-top"><div><p className="eyebrow">PROFILE PROGRESS</p><h2>档案进度</h2></div><BarChart3 size={20} aria-hidden="true" /></div>
          <strong className="growth-number">{profileCompletion}<small>%</small></strong>
          <ProgressLine value={profileCompletion} compact />
          <p>{profileCompletion === 100 ? "基础档案已经完整，可以继续生成职业报告并针对岗位验证能力证据。" : "继续补充真实的基础信息、技能和项目经历，后续 Agent 的分析会更准确。"}</p>
          <div className="growth-foot"><span>档案更新时间</span><b>{profileUpdatedLabel}</b></div>
        </article>
      </section>

      <section className="career-intelligence">
        <div className="career-intelligence-head">
          <div><p className="eyebrow">CAREER INTELLIGENCE</p><h2>AI 职业决策报告</h2><span>职业定位、能力诊断和提升计划由 3 个独立 Agent 协作完成。</span></div>
          <button className="primary-button" onClick={() => void generateCareerIntelligence()} disabled={intelligenceLoading}>
            {intelligenceLoading ? <><RefreshCw size={15} className="spin" />3 个 Agent 正在协作…</> : intelligence ? <><RefreshCw size={15} />重新生成</> : <><BrainCircuit size={15} />生成职业报告</>}
          </button>
        </div>
        {intelligenceError ? <div className="career-intelligence-error" role="alert"><TriangleAlert size={15} />{intelligenceError}</div> : null}
        {(intelligenceLoading || intelligence) ? <AgentTrace title="职业决策协作链" steps={intelligenceSteps} /> : null}
        {!intelligence ? (
          <div className="career-intelligence-empty">
            {[{ icon: Target, title: "职业定位", text: "从档案证据提出相邻岗位假设" }, { icon: BrainCircuit, title: "能力诊断", text: "区分已有证据和关键差距" }, { icon: Route, title: "提升计划", text: "把差距拆成四周真实交付物" }].map(({ icon: Icon, title, text }, index) => <div key={title}><span><Icon size={17} /></span><p><small>AGENT 0{index + 6}</small><b>{title}</b><em>{text}</em></p></div>)}
          </div>
        ) : (
          <div className="career-intelligence-grid">
            <article className="positioning-report">
              <div className="intelligence-card-title"><span><Target size={16} /></span><p><small>AGENT 06</small><b>职业定位</b></p></div>
              <p className="positioning-summary">{intelligence.positioning.summary}</p>
              {intelligence.positioning.recommendedRoles.slice(0, 3).map((role, index) => <div className="career-role" key={`${role.role}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{role.role}</b><p>{role.fitReason}</p><small>{role.nextExperiment}</small></div><strong>{Math.round(role.fitScore)}<small>%</small></strong></div>)}
              <blockquote>{intelligence.positioning.positioningStatement}</blockquote>
            </article>
            <article className="gap-report">
              <div className="intelligence-card-title"><span><BrainCircuit size={16} /></span><p><small>AGENT 07</small><b>能力诊断</b></p><strong>{Math.round(intelligence.gap.readinessScore)}<small>/100</small></strong></div>
              <p className="gap-summary">{intelligence.gap.summary}</p>
              <div className="gap-evidence"><b>已有证据</b>{intelligence.gap.strengths.slice(0, 2).map((item) => <p key={item.skill}><Check size={12} />{item.skill}<small>{item.evidence[0] || "待补充"}</small></p>)}</div>
              <div className="gap-priorities"><b>优先补足</b>{intelligence.gap.gaps.slice(0, 3).map((item) => <div key={item.skill}><span className={item.priority}>{item.priority === "high" ? "高" : item.priority === "medium" ? "中" : "低"}</span><p><b>{item.skill}</b><small>{item.nextProof}</small></p></div>)}</div>
            </article>
            <article className="growth-plan-report">
              <div className="intelligence-card-title"><span><Lightbulb size={16} /></span><p><small>AGENT 08</small><b>{intelligence.plan.title}</b></p></div>
              <p>{intelligence.plan.objective}</p>
              <div className="weekly-plan">{intelligence.plan.weeklyPlan.map((week) => <div key={week.week}><span>W{week.week}</span><p><b>{week.focus}</b><small>{week.deliverable}</small></p></div>)}</div>
              <small className="intelligence-engine">由 {intelligence.meta.demo ? "演示引擎" : intelligence.meta.provider} 生成 · 评分表示档案证据完整度，不代表录用概率</small>
            </article>
          </div>
        )}
      </section>

      <section className="journey-section">
        <div className="section-title-row"><div><p className="eyebrow">YOUR ROUTE</p><h2>求职成长路径</h2></div><p className="journey-progress">已完成 <b>{completedJourneySteps} / 6</b></p></div>
        <div className="journey-list">
          {journey.map(({ number, title, note, detail, status, icon: Icon, href }) => {
            const done = status === "已完成"; const active = status === "进行中";
            return (
              <article key={number} className={`journey-item ${done ? "done" : ""} ${active ? "active" : ""}`}>
                <div className="journey-marker">{done ? <Check size={16} /> : number}</div>
                <div className="journey-icon"><Icon size={21} /></div>
                <div className="journey-copy"><div><h3>{title}</h3><span>{note}</span></div><p>{detail}</p></div>
                <span className="journey-status">{status}</span>
                <Link href={href} className="journey-action" aria-label={`进入${title}`}><ArrowRight size={18} /></Link>
              </article>
            );
          })}
        </div>
      </section>

      {editingTarget ? (
        <div className="dialog-backdrop" role="presentation">
          <form className="target-dialog" role="dialog" aria-modal="true" aria-labelledby="target-dialog-title" onSubmit={saveTarget}>
            <div className="dialog-title"><div><p className="eyebrow">UPDATE DESTINATION</p><h2 id="target-dialog-title">调整求职目标</h2></div><button type="button" onClick={() => setEditingTarget(false)} aria-label="关闭"><X size={18} /></button></div>
            <label>目标岗位<input name="target-role" value={targetDraft.role} onChange={(event) => setTargetDraft((current) => ({ ...current, role: event.target.value }))} autoComplete="organization-title" required /></label>
            <label>目标城市<input name="target-cities" value={targetDraft.cities} onChange={(event) => setTargetDraft((current) => ({ ...current, cities: event.target.value }))} autoComplete="address-level2" required /></label>
            <label>目标行业<input name="target-industry" value={targetDraft.industry} onChange={(event) => setTargetDraft((current) => ({ ...current, industry: event.target.value }))} autoComplete="off" required /></label>
            <label>求职阶段<input name="career-stage" value={targetDraft.stage} onChange={(event) => setTargetDraft((current) => ({ ...current, stage: event.target.value }))} autoComplete="off" required /></label>
            <div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setEditingTarget(false)}>取消</button><button type="submit" className="primary-button"><Save size={15} />保存目标</button></div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
