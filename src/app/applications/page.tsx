"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AppShell, PageHeading, ProgressLine } from "@/components/ui/app-shell";
import { useApplications } from "@/hooks/use-applications";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { runAgent, type AgentMeta } from "@/lib/agent-client";
import { saveApplications } from "@/lib/application-store";
import type { ApplicationManagement, ApplicationRecord, ApplicationStage, OfferCandidate, OfferDecision } from "@/lib/schemas";

const stages: Array<{ id: Exclude<ApplicationStage, "closed">; label: string }> = [
  { id: "interested", label: "感兴趣" },
  { id: "preparing", label: "准备中" },
  { id: "applied", label: "已投递" },
  { id: "interview", label: "面试中" },
  { id: "offer", label: "已获 Offer" },
];

const emptyOffer = (id: string): OfferCandidate => ({
  id,
  company: "",
  role: "",
  location: "",
  monthlySalary: 0,
  salaryMonths: 12,
  bonus: 0,
  growth: "",
  workLife: "",
  notes: "",
});

type ApplicationDraft = {
  company: string;
  role: string;
  stage: Exclude<ApplicationStage, "closed">;
  nextAction: string;
  deadline: string;
};

export default function ApplicationsPage() {
  const applications = useApplications();
  const profile = useCareerProfile();
  const activeApplications = applications.filter((item) => item.stage !== "closed");
  const [managerReport, setManagerReport] = useState<{ data: ApplicationManagement; meta: AgentMeta } | null>(null);
  const [managerLoading, setManagerLoading] = useState(false);
  const [managerError, setManagerError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<ApplicationDraft>({ company: "", role: "", stage: "interested", nextAction: "", deadline: "" });
  const [offers, setOffers] = useState<OfferCandidate[]>([emptyOffer("offer-a"), emptyOffer("offer-b")]);
  const [offerReport, setOfferReport] = useState<{ data: OfferDecision; meta: AgentMeta } | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState("");

  function resetManagerReport() {
    setManagerReport(null);
    setManagerError("");
  }

  function updateApplication(id: string, patch: Partial<ApplicationRecord>) {
    saveApplications(applications.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
    resetManagerReport();
  }

  function removeApplication(id: string) {
    saveApplications(applications.filter((item) => item.id !== id));
    resetManagerReport();
  }

  function addApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const record: ApplicationRecord = {
      id: `application-${Date.now()}`,
      company: draft.company.trim(),
      role: draft.role.trim(),
      jobId: "",
      stage: draft.stage,
      nextAction: draft.nextAction.trim(),
      deadline: draft.deadline,
      notes: "",
      updatedAt: new Date().toISOString(),
    };
    saveApplications([...applications, record]);
    setDraft({ company: "", role: "", stage: "interested", nextAction: "", deadline: "" });
    setAddOpen(false);
    resetManagerReport();
  }

  async function analyzeApplications() {
    if (managerLoading) return;
    setManagerLoading(true);
    setManagerError("");
    try {
      const response = await runAgent<ApplicationManagement>("application", { applications: activeApplications }, { profile });
      setManagerReport(response);
    } catch (error) {
      setManagerError(error instanceof Error ? error.message : "投递分析失败");
    } finally {
      setManagerLoading(false);
    }
  }

  function updateOffer(id: string, field: keyof OfferCandidate, value: string | number) {
    setOffers((current) => current.map((offer) => offer.id === id ? { ...offer, [field]: value } : offer));
    setOfferReport(null);
    setOfferError("");
  }

  function loadOfferExample() {
    setOffers([
      { id: "offer-a", company: "A 公司（示例）", role: "AI 产品实习生", location: "上海", monthlySalary: 9000, salaryMonths: 12, bonus: 0, growth: "参与完整 AI 产品迭代", workLife: "待向团队核实", notes: "示例数据，请替换为书面 Offer 信息" },
      { id: "offer-b", company: "B 公司（示例）", role: "产品策划实习生", location: "杭州", monthlySalary: 7500, salaryMonths: 13, bonus: 3000, growth: "有导师和轮岗机会", workLife: "待向团队核实", notes: "示例数据，请替换为书面 Offer 信息" },
    ]);
    setOfferReport(null);
    setOfferError("");
  }

  async function compareOffers() {
    const comparable = offers.filter((offer) => offer.company.trim() && offer.role.trim());
    if (comparable.length < 2 || offerLoading) {
      setOfferError("请至少填写两份 Offer 的公司和岗位。暂时没有真实 Offer 时，可载入示例体验流程。");
      return;
    }
    setOfferLoading(true);
    setOfferError("");
    try {
      const response = await runAgent<OfferDecision>("offer", { offers: comparable }, { profile });
      setOfferReport(response);
    } catch (error) {
      setOfferError(error instanceof Error ? error.message : "Offer 比较失败");
    } finally {
      setOfferLoading(false);
    }
  }

  return (
    <AppShell>
      <PageHeading eyebrow="APPLICATION PIPELINE" title="投递中心" description="把感兴趣、准备、投递、面试和 Offer 放进同一条可追踪的求职流水线。" action={<button className="primary-button" onClick={() => setAddOpen(true)}><Plus size={15} />添加记录</button>} />

      <section className="application-dashboard">
        <article className="application-board">
          <div className="application-board-head"><div><p className="eyebrow">MY PIPELINE</p><h2>投递进度</h2><span>{activeApplications.length} 条进行中 · 首次打开包含可删除的示例记录</span></div><button className="secondary-button" onClick={() => void analyzeApplications()} disabled={managerLoading}>{managerLoading ? <><RefreshCw size={14} className="spin" />正在分析…</> : <><Sparkles size={14} />AI 整理下一步</>}</button></div>
          <div className="pipeline-stats">{stages.map((stage) => <div key={stage.id}><strong>{activeApplications.filter((item) => item.stage === stage.id).length}</strong><span>{stage.label}</span></div>)}</div>
          <div className="application-list">
            {activeApplications.length ? activeApplications.map((item) => <article key={item.id} className="application-row">
              <span className="company-mark">{item.company.slice(0, 1)}</span>
              <div className="application-main"><small>{item.company}</small><b>{item.role}</b><p>{item.nextAction || "尚未填写下一步行动"}</p></div>
              <label><span>阶段</span><select value={item.stage} onChange={(event) => updateApplication(item.id, { stage: event.target.value as ApplicationStage })}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>
              <label><span>日期</span><input type="date" value={item.deadline} onChange={(event) => updateApplication(item.id, { deadline: event.target.value })} /></label>
              <div className="application-links">{item.jobId ? <Link href={`/jobs?job=${item.jobId}`}>岗位详情<ArrowRight size={12} /></Link> : null}<button onClick={() => removeApplication(item.id)} aria-label={`删除 ${item.company} ${item.role}`}><Trash2 size={13} /></button></div>
            </article>) : <div className="applications-empty"><ClipboardCheck size={23} /><h3>还没有投递记录</h3><p>先添加一个感兴趣的岗位，Agent 才能根据真实进度整理下一步。</p><button className="secondary-button" onClick={() => setAddOpen(true)}>添加第一条记录</button></div>}
          </div>
        </article>

        <aside className="application-coach">
          <div className="application-coach-head"><span><Sparkles size={15} /></span><p><small>AGENT 09</small><b>投递管理 Agent</b></p></div>
          {managerError ? <div className="application-error"><TriangleAlert size={14} />{managerError}</div> : null}
          {managerReport ? <>
            <div className="pipeline-health"><strong>{Math.round(managerReport.data.pipelineHealth)}<small>/100</small></strong><p><b>流水线清晰度</b><span>{managerReport.meta.demo ? "演示引擎" : managerReport.meta.provider} 已完成分析</span></p></div>
            <ProgressLine value={managerReport.data.pipelineHealth} />
            <p className="application-summary">{managerReport.data.summary}</p>
            <div className="priority-list"><h3>优先行动</h3>{managerReport.data.priorities.map((priority, index) => { const item = applications.find((application) => application.id === priority.applicationId); return <div key={`${priority.applicationId}-${index}`}><span className={priority.urgency}>{priority.urgency === "today" ? "今天" : priority.urgency === "this_week" ? "本周" : "稍后"}</span><p><b>{item ? `${item.company} · ${item.role}` : "投递记录"}</b><small>{priority.action}</small><em>{priority.reason}</em></p></div>; })}</div>
            {managerReport.data.risks.length ? <div className="application-risks"><h3>记录风险</h3>{managerReport.data.risks.map((risk) => <p key={risk}><TriangleAlert size={11} />{risk}</p>)}</div> : null}
          </> : <div className="application-coach-empty"><CalendarDays size={24} /><h3>让每次投递都有下一步</h3><p>Agent 会检查阶段、截止信息和下一步行动，但不会替你投递或联系招聘方。</p></div>}
        </aside>
      </section>

      <section className="offer-lab">
        <div className="offer-lab-head"><div><p className="eyebrow">OFFER DECISION LAB</p><h2>Offer 决策</h2><span>填写书面 Offer 中已经确认的信息，再比较现金、成长、地点和未知风险。</span></div><div><button className="secondary-button" onClick={loadOfferExample}>载入示例</button><button className="primary-button" onClick={() => void compareOffers()} disabled={offerLoading}>{offerLoading ? <><RefreshCw size={14} className="spin" />正在比较…</> : <><CircleDollarSign size={15} />AI 比较 Offer</>}</button></div></div>
        <div className="offer-grid">
          <div className="offer-inputs">
            {offers.map((offer, index) => <article className="offer-card" key={offer.id}>
              <div className="offer-card-title"><span>{String(index + 1).padStart(2, "0")}</span><h3>Offer {String.fromCharCode(65 + index)}</h3>{offers.length > 2 ? <button onClick={() => setOffers((current) => current.filter((item) => item.id !== offer.id))} aria-label="删除这份 Offer"><X size={13} /></button> : null}</div>
              <div className="offer-fields">
                <label>公司<input value={offer.company} onChange={(event) => updateOffer(offer.id, "company", event.target.value)} placeholder="以书面 Offer 为准" /></label>
                <label>岗位<input value={offer.role} onChange={(event) => updateOffer(offer.id, "role", event.target.value)} placeholder="岗位名称" /></label>
                <label>城市<input value={offer.location} onChange={(event) => updateOffer(offer.id, "location", event.target.value)} placeholder="工作城市" /></label>
                <label>税前月薪<input type="number" min="0" value={offer.monthlySalary || ""} onChange={(event) => updateOffer(offer.id, "monthlySalary", Number(event.target.value))} placeholder="元" /></label>
                <label>发薪月数<input type="number" min="0" step="0.5" value={offer.salaryMonths || ""} onChange={(event) => updateOffer(offer.id, "salaryMonths", Number(event.target.value))} /></label>
                <label>已确认奖金<input type="number" min="0" value={offer.bonus || ""} onChange={(event) => updateOffer(offer.id, "bonus", Number(event.target.value))} placeholder="元" /></label>
                <label className="wide">成长信息<input value={offer.growth} onChange={(event) => updateOffer(offer.id, "growth", event.target.value)} placeholder="导师、业务方向、成长路径；未知就留空" /></label>
                <label className="wide">工作节奏<input value={offer.workLife} onChange={(event) => updateOffer(offer.id, "workLife", event.target.value)} placeholder="仅填写已核实信息" /></label>
              </div>
            </article>)}
            <button className="add-offer-button" onClick={() => setOffers((current) => [...current, emptyOffer(`offer-${Date.now()}`)])}><Plus size={14} />再添加一份 Offer</button>
          </div>
          <aside className="offer-report">
            <div className="offer-report-head"><span><Sparkles size={15} /></span><p><small>AGENT 10</small><b>Offer 决策 Agent</b></p></div>
            {offerError ? <div className="application-error"><TriangleAlert size={14} />{offerError}</div> : null}
            {offerReport ? <>
              <p className="offer-recommendation">{offerReport.data.recommendation}</p>
              <div className="offer-ranking">{offerReport.data.ranking.map((rank, index) => { const offer = offers.find((item) => item.id === rank.offerId); return <div key={rank.offerId}><span>{index + 1}</span><p><b>{offer ? `${offer.company} · ${offer.role}` : "Offer"}</b><small>{rank.reasons[0]}</small></p><strong>{Math.round(rank.score)}</strong></div>; })}</div>
              <section><h3>需要核实</h3>{offerReport.data.questionsToVerify.slice(0, 3).map((item) => <p key={item}><TriangleAlert size={11} />{item}</p>)}</section>
              <section><h3>可沟通事项</h3>{offerReport.data.negotiationPoints.slice(0, 3).map((item) => <p key={item}><Check size={11} />{item}</p>)}</section>
              <small className="offer-disclaimer">{offerReport.data.disclaimer}</small>
            </> : <div className="offer-report-empty"><BriefcaseBusiness size={24} /><h3>先把未知变成问题</h3><p>没有填写的信息不会被当作优势。Agent 会同时给出排名、权衡点和签约前需要核实的问题。</p></div>}
          </aside>
        </div>
      </section>

      {addOpen ? <div className="dialog-backdrop" role="presentation"><form className="application-dialog" role="dialog" aria-modal="true" aria-labelledby="application-dialog-title" onSubmit={addApplication}>
        <div className="dialog-title"><div><p className="eyebrow">NEW APPLICATION</p><h2 id="application-dialog-title">添加投递记录</h2></div><button type="button" onClick={() => setAddOpen(false)} aria-label="关闭"><X size={18} /></button></div>
        <label>公司<input required value={draft.company} onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))} /></label>
        <label>岗位<input required value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))} /></label>
        <label>当前阶段<select value={draft.stage} onChange={(event) => setDraft((current) => ({ ...current, stage: event.target.value as ApplicationDraft["stage"] }))}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>
        <label>截止或跟进日期<input type="date" value={draft.deadline} onChange={(event) => setDraft((current) => ({ ...current, deadline: event.target.value }))} /></label>
        <label className="wide">下一步行动<input value={draft.nextAction} onChange={(event) => setDraft((current) => ({ ...current, nextAction: event.target.value }))} placeholder="例如：完成定向简历" /></label>
        <div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setAddOpen(false)}>取消</button><button type="submit" className="primary-button"><Plus size={14} />保存记录</button></div>
      </form></div> : null}
    </AppShell>
  );
}
