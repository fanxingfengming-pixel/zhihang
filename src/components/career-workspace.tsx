"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  FileSearch,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  Menu,
  RotateCcw,
  Sparkles,
  Target,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  EMPTY_PROFILE,
  type AgentName,
  type CareerProfile,
  type JDAnalysis,
  type MatchReport,
} from "@/lib/schemas";
import { calculateProfileCompletion } from "@/lib/career-profile-metrics";

type WorkspaceAgentName = Extract<AgentName, "resume" | "jd" | "match">;

type Provider = "deepseek" | "qwen";
type ApiResponse<T> = { data: T; meta: { provider: string; demo: boolean } } | { error: string };

const agentMeta = [
  { id: "resume" as const, number: "01", title: "简历构建", short: "把零散经历变成一份好简历", icon: FileText },
  { id: "jd" as const, number: "02", title: "JD 解析", short: "看清岗位真正需要什么", icon: FileSearch },
  { id: "match" as const, number: "03", title: "岗位匹配", short: "找到优势、差距与行动顺序", icon: Target },
];

const sampleResume = {
  name: "林小满",
  school: "南华大学",
  major: "建筑环境与能源应用工程",
  grade: "大三",
  targetRole: "AI 产品实习生",
  location: "长沙 / 可远程",
  skills: "AI Agent、Prompt 设计、Excel、Python 基础、PPT",
  experience: "策划大学生 AI 求职智能体项目，梳理 11 个 Agent 的功能边界，完成用户流程和产品原型；在课程小组中负责数据整理和最终汇报。",
};

const sampleJD = `公司：星云科技\n岗位：AI 产品实习生\n岗位职责：\n1. 协助 AI 产品的需求调研、竞品分析与功能设计；\n2. 参与大模型应用的 Prompt 测试和效果评估；\n3. 使用数据分析工具跟踪产品效果，协同研发推动迭代。\n任职要求：\n1. 本科及以上在读，计算机、产品设计或相关专业优先；\n2. 了解大模型、AI Agent 或 Prompt Engineering；\n3. 熟练使用 Excel、PPT，具备基础数据分析能力；\n4. 有 AI 应用项目、产品作品集或 Python 基础者优先。`;

export function CareerWorkspace() {
  const [activeAgent, setActiveAgent] = useState<WorkspaceAgentName>("resume");
  const [provider, setProvider] = useState<Provider>("deepseek");
  const [profile, setProfile] = useState<CareerProfile>(EMPTY_PROFILE);
  const [jd, setJd] = useState<JDAnalysis | null>(null);
  const [match, setMatch] = useState<MatchReport | null>(null);
  const [resumeForm, setResumeForm] = useState(sampleResume);
  const [jdText, setJdText] = useState(sampleJD);
  const [loading, setLoading] = useState<WorkspaceAgentName | null>(null);
  const [notice, setNotice] = useState<string>("");
  const [demoMode, setDemoMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("zhihang-career-profile");
    if (saved) {
      // Client-only persistence must hydrate after the server-rendered first frame.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      try { setProfile(JSON.parse(saved) as CareerProfile); } catch { window.localStorage.removeItem("zhihang-career-profile"); }
    }
  }, []);

  useEffect(() => {
    if (profile.updatedAt) window.localStorage.setItem("zhihang-career-profile", JSON.stringify(profile));
  }, [profile]);

  const completion = useMemo(() => calculateProfileCompletion(profile), [profile]);

  async function runAgent<T>(agent: WorkspaceAgentName, input: unknown, context?: unknown) {
    setLoading(agent);
    setNotice("");
    try {
      const response = await fetch(`/api/agents/${agent}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, input, context }),
      });
      const payload = (await response.json()) as ApiResponse<T>;
      if (!("data" in payload)) throw new Error(payload.error);
      setDemoMode(payload.meta.demo);
      setNotice(payload.meta.demo ? "已用演示引擎完成。本地配置 API Key 后会自动调用真实模型。" : `已由 ${provider === "deepseek" ? "DeepSeek" : "通义千问"} 完成分析。`);
      return payload.data;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "请求失败，请稍后重试");
      return null;
    } finally {
      setLoading(null);
    }
  }

  async function buildResume(event: FormEvent) {
    event.preventDefault();
    const result = await runAgent<CareerProfile>("resume", resumeForm, { currentProfile: profile });
    if (result) { setProfile(result); setActiveAgent("jd"); }
  }

  async function parseJD(event: FormEvent) {
    event.preventDefault();
    const result = await runAgent<JDAnalysis>("jd", jdText);
    if (result) { setJd(result); setMatch(null); setActiveAgent("match"); }
  }

  async function calculateMatch() {
    const result = await runAgent<MatchReport>("match", "请完成岗位匹配分析", { profile, jd });
    if (result) setMatch(result);
  }

  function resetWorkspace() {
    setProfile(EMPTY_PROFILE); setJd(null); setMatch(null); setActiveAgent("resume"); setNotice("");
    window.localStorage.removeItem("zhihang-career-profile");
  }

  return (
    <div className="min-h-screen bg-[#f4f6f2] text-[#17231f]">
      <header className="sticky top-0 z-40 border-b border-[#dfe5df] bg-[#f4f6f2]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-xl p-2 hover:bg-white lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="打开导航"><Menu size={21} /></button>
            <div className="grid size-9 place-items-center rounded-xl bg-[#173c30] text-white shadow-[0_6px_18px_rgba(23,60,48,.22)]"><GraduationCap size={20} /></div>
            <div>
              <p className="text-[17px] font-extrabold tracking-tight">职航 <span className="font-normal text-[#a0aaa4]">/</span> CareerPilot</p>
              <p className="text-xs font-semibold tracking-[.18em] text-[#7e8983]">AI 求职实训空间</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-full border border-[#dce4dc] bg-white px-3.5 py-2 sm:flex">
              <span className="size-2 rounded-full bg-[#66ad73] shadow-[0_0_0_3px_#e4f3e4]" />
              <span className="text-xs font-semibold text-[#52625a]">系统就绪</span>
            </div>
            <select aria-label="选择模型" value={provider} onChange={(e) => setProvider(e.target.value as Provider)} className="h-9 rounded-full border border-[#dce4dc] bg-white px-3 text-xs font-bold outline-none focus:border-[#4f886d]">
              <option value="deepseek">DeepSeek</option>
              <option value="qwen">通义千问</option>
            </select>
            <button onClick={resetWorkspace} className="grid size-9 place-items-center rounded-full border border-[#dce4dc] bg-white text-[#647169] hover:text-[#173c30]" title="清空档案"><RotateCcw size={15} /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[238px_minmax(0,1fr)_292px]">
        <Sidebar open={sidebarOpen} close={() => setSidebarOpen(false)} active={activeAgent} setActive={(id) => { setActiveAgent(id); setSidebarOpen(false); }} />

        <main className="min-w-0 px-5 py-8 md:px-8 lg:px-10 lg:py-10">
          <section className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#4f8069]"><Sparkles size={14} /> 你的 AI 求职作战台</div>
              <h1 className="max-w-2xl text-3xl font-black leading-[1.15] tracking-[-.035em] text-[#13251e] md:text-[42px]">
                从一张空白简历，<br /><span className="text-[#4d7b64]">走到更适合你的机会。</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#66736c]">三个 Agent 共享同一份求职档案，每一步都为下一步积累更清晰的证据。</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[#dce3dc] bg-white p-2 pr-4 shadow-sm">
              <div className="grid size-10 place-items-center rounded-xl bg-[#e8f2ea] text-[#38684f]"><Zap size={19} /></div>
              <div><p className="text-xs font-semibold text-[#89938e]">当前运行模式</p><p className="text-sm font-bold">{demoMode ? "本地演示 · 零成本" : `${provider === "deepseek" ? "DeepSeek" : "通义千问"} · 自动回退`}</p></div>
            </div>
          </section>

          <AgentStepper active={activeAgent} setActive={setActiveAgent} completed={{ resume: Boolean(profile.updatedAt), jd: Boolean(jd), match: Boolean(match) }} />

          {notice && <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-[#d8e6d9] bg-[#edf6ed] px-4 py-3 text-sm text-[#315c45]"><CheckCircle2 className="mt-0.5 shrink-0" size={16} /><span>{notice}</span></div>}

          {activeAgent === "resume" && (
            <ResumePanel form={resumeForm} setForm={setResumeForm} onSubmit={buildResume} loading={loading === "resume"} profile={profile} />
          )}
          {activeAgent === "jd" && (
            <JDPanel text={jdText} setText={setJdText} onSubmit={parseJD} loading={loading === "jd"} jd={jd} />
          )}
          {activeAgent === "match" && (
            <MatchPanel profile={profile} jd={jd} match={match} loading={loading === "match"} run={calculateMatch} goTo={setActiveAgent} />
          )}
        </main>

        <ProfileRail profile={profile} completion={completion} jd={jd} />
      </div>
    </div>
  );
}

function Sidebar({ open, close, active, setActive }: { open: boolean; close: () => void; active: WorkspaceAgentName; setActive: (id: WorkspaceAgentName) => void }) {
  return (
    <>
      {open && <button className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={close} aria-label="关闭导航遮罩" />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[270px] border-r border-[#e0e5e0] bg-[#eef1ed] p-5 pt-6 transition-transform lg:sticky lg:top-[72px] lg:z-0 lg:h-[calc(100vh-72px)] lg:w-auto lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-8 flex items-center justify-between lg:hidden"><span className="font-bold">功能导航</span><button onClick={close}><X size={20} /></button></div>
        <p className="mb-3 px-3 text-xs font-bold uppercase tracking-[.18em] text-[#929b96]">Workspace</p>
        <button className="mb-2 flex w-full items-center gap-3 rounded-xl bg-[#dfe8df] px-3 py-3 text-left text-sm font-bold text-[#214636]"><LayoutDashboard size={17} />求职工作台</button>
        <div className="my-6 h-px bg-[#dce2dc]" />
        <p className="mb-3 px-3 text-xs font-bold uppercase tracking-[.18em] text-[#929b96]">AI Agents</p>
        <nav className="space-y-1.5">
          {agentMeta.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} onClick={() => setActive(item.id)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${active === item.id ? "bg-[#173c30] font-bold text-white shadow-lg shadow-[#173c30]/10" : "text-[#657169] hover:bg-white"}`}><Icon size={17} /><span className="flex-1">{item.title} Agent</span><ChevronRight size={14} className={active === item.id ? "opacity-80" : "opacity-0 group-hover:opacity-50"} /></button>;
          })}
        </nav>
        <div className="absolute bottom-6 left-5 right-5 rounded-2xl border border-[#d8e0d8] bg-white/70 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#3a5c4d]"><WandSparkles size={14} /> MVP 提示</div>
          <p className="text-xs leading-5 text-[#7b8780]">档案仅保存在你的浏览器，本阶段不上传数据库。</p>
        </div>
      </aside>
    </>
  );
}

function AgentStepper({ active, setActive, completed }: { active: WorkspaceAgentName; setActive: (id: WorkspaceAgentName) => void; completed: Record<WorkspaceAgentName, boolean> }) {
  return (
    <section className="mb-5 grid gap-3 md:grid-cols-3">
      {agentMeta.map((item) => {
        const Icon = item.icon; const selected = active === item.id;
        return <button key={item.id} onClick={() => setActive(item.id)} className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-[transform,border-color,background-color,color,box-shadow] ${selected ? "border-[#2f644f] bg-[#173c30] text-white shadow-[0_12px_32px_rgba(23,60,48,.16)]" : "border-[#dee4de] bg-white hover:-translate-y-0.5 hover:border-[#b8c8bd]"}`}>
          <div className="flex items-start justify-between"><div className={`grid size-9 place-items-center rounded-xl ${selected ? "bg-white/12" : "bg-[#edf2ed] text-[#4c7160]"}`}><Icon size={17} /></div>{completed[item.id] ? <CheckCircle2 size={17} className={selected ? "text-[#b7e698]" : "text-[#5d9a6a]"} /> : <span className={`text-xs font-bold tracking-wider ${selected ? "text-white/45" : "text-[#adb5b0]"}`}>{item.number}</span>}</div>
          <h2 className="mt-4 text-sm font-extrabold">{item.title}</h2><p className={`mt-1 text-xs leading-5 ${selected ? "text-white/60" : "text-[#87908b]"}`}>{item.short}</p>
          {selected && <div className="absolute -bottom-6 -right-5 size-20 rounded-full bg-[#a8df7b]/10" />}
        </button>;
      })}
    </section>
  );
}

function PanelShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-[24px] border border-[#dce3dc] bg-white shadow-[0_12px_40px_rgba(31,55,45,.05)]"><div className="border-b border-[#e8ece8] px-6 py-5 md:px-7"><p className="text-xs font-extrabold uppercase tracking-[.17em] text-[#669078]">{eyebrow}</p><h2 className="mt-1.5 text-xl font-black tracking-tight">{title}</h2><p className="mt-1.5 text-xs leading-5 text-[#7a8580]">{description}</p></div>{children}</section>;
}

function ResumePanel({ form, setForm, onSubmit, loading, profile }: { form: typeof sampleResume; setForm: React.Dispatch<React.SetStateAction<typeof sampleResume>>; onSubmit: (e: FormEvent) => void; loading: boolean; profile: CareerProfile }) {
  const field = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  return <PanelShell eyebrow="Agent 01 · Experience Miner" title="先认识你，再开始写简历" description="真实经历不等于实习。课程、竞赛、社团和个人作品，都是可挖掘的求职证据。">
    <form onSubmit={onSubmit} className="p-6 md:p-7">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="姓名"><input name="name" value={form.name} onChange={(e) => field("name", e.target.value)} autoComplete="name" placeholder="怎么称呼你…" /></Field>
        <Field label="学校"><input name="school" value={form.school} onChange={(e) => field("school", e.target.value)} autoComplete="organization" placeholder="学校名称…" /></Field>
        <Field label="专业"><input name="major" value={form.major} onChange={(e) => field("major", e.target.value)} autoComplete="off" placeholder="所学专业…" /></Field>
        <Field label="年级"><input name="grade" value={form.grade} onChange={(e) => field("grade", e.target.value)} autoComplete="off" placeholder="如：大三…" /></Field>
        <Field label="目标岗位"><input name="target-role" value={form.targetRole} onChange={(e) => field("targetRole", e.target.value)} autoComplete="organization-title" placeholder="如：AI 产品实习生…" required /></Field>
        <Field label="意向地点"><input name="location" value={form.location} onChange={(e) => field("location", e.target.value)} autoComplete="address-level2" placeholder="城市 / 可远程…" /></Field>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="技能与工具" hint="用逗号分隔"><textarea name="skills" value={form.skills} onChange={(e) => field("skills", e.target.value)} autoComplete="off" rows={5} placeholder="Excel、Python、Figma…" /></Field>
        <Field label="经历素材" hint="先写事实，不用润色"><textarea name="experience" value={form.experience} onChange={(e) => field("experience", e.target.value)} autoComplete="off" rows={5} placeholder="做过什么？承担什么？结果如何？" /></Field>
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-[#edf0ed] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[#87918b]">AI 只会重组你提供的事实，不会虚构经历。</p>
        <SubmitButton loading={loading} label={profile.updatedAt ? "重新生成简历" : "生成我的基础简历"} />
      </div>
    </form>
    {profile.resumeMarkdown && <ResultBlock title="基础简历预览"><MarkdownResume content={profile.resumeMarkdown} /></ResultBlock>}
  </PanelShell>;
}

function JDPanel({ text, setText, onSubmit, loading, jd }: { text: string; setText: (v: string) => void; onSubmit: (e: FormEvent) => void; loading: boolean; jd: JDAnalysis | null }) {
  return <PanelShell eyebrow="Agent 02 · Requirement Decoder" title="把一段 JD，拆成一张能力地图" description="粘贴完整岗位描述，Agent 会识别硬性要求、加分项、关键词和隐含优先级。">
    <form onSubmit={onSubmit} className="p-6 md:p-7">
      <Field label="岗位描述（JD）" hint={`${text.length} 字`}><textarea name="jd-text" className="min-h-[260px] font-mono text-[13px] leading-6" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder="请粘贴招聘网站中的完整岗位描述…" required /></Field>
      <div className="mt-6 flex justify-end"><SubmitButton loading={loading} label="解析岗位要求" /></div>
    </form>
    {jd && <ResultBlock title={`${jd.company} · ${jd.jobTitle}`}><div className="grid gap-6 md:grid-cols-2"><InfoList title="核心职责" items={jd.responsibilities} /><InfoList title="硬性要求" items={jd.requiredSkills} /><InfoList title="加分项" items={jd.preferredSkills} /><div><p className="mb-3 text-xs font-extrabold text-[#43544c]">关键词</p><TagList items={jd.keywords} /></div></div></ResultBlock>}
  </PanelShell>;
}

function MatchPanel({ profile, jd, match, loading, run, goTo }: { profile: CareerProfile; jd: JDAnalysis | null; match: MatchReport | null; loading: boolean; run: () => void; goTo: (id: WorkspaceAgentName) => void }) {
  const ready = Boolean(profile.updatedAt && jd);
  return <PanelShell eyebrow="Agent 03 · Evidence Matcher" title="不是猜匹配度，而是逐条找证据" description="把学生档案与岗位要求放在同一张表上，明确能投、缺什么、先做什么。">
    <div className="p-6 md:p-7">
      <div className="grid gap-3 sm:grid-cols-2">
        <ReadyCard ready={Boolean(profile.updatedAt)} title="Career Profile" detail={profile.updatedAt ? `${profile.basics.name || "学生"} · ${profile.skills.length} 项技能` : "请先完成简历构建"} action={() => goTo("resume")} />
        <ReadyCard ready={Boolean(jd)} title="岗位能力地图" detail={jd ? `${jd.company} · ${jd.jobTitle}` : "请先解析目标 JD"} action={() => goTo("jd")} />
      </div>
      <button disabled={!ready || loading} onClick={run} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#173c30] px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-[#173c30]/10 transition hover:bg-[#22503f] disabled:cursor-not-allowed disabled:bg-[#b9c2bd]">{loading ? <LoaderCircle className="animate-spin" size={17} /> : <Target size={17} />}{loading ? "正在逐条比对…" : "生成岗位匹配报告"}</button>
    </div>
    {match && <ResultBlock title="岗位匹配报告"><div className="mb-7 flex flex-col gap-5 rounded-2xl bg-[#173c30] p-5 text-white sm:flex-row sm:items-center"><ScoreRing score={match.score} /><div><p className="text-xs font-bold uppercase tracking-[.16em] text-white/50">Match verdict</p><h3 className="mt-1 text-lg font-extrabold">{match.verdict}</h3><p className="mt-2 text-xs leading-5 text-white/60">分数用于发现差距，不代表录用概率。</p></div></div><div className="grid gap-6 md:grid-cols-2"><InfoList title="已匹配能力" items={match.matchedSkills} positive /><InfoList title="关键差距" items={match.gaps} /><InfoList title="证据依据" items={match.evidence} /><InfoList title="下一步行动" items={match.actionPlan} numbered /></div></ResultBlock>}
  </PanelShell>;
}

function ProfileRail({ profile, completion, jd }: { profile: CareerProfile; completion: number; jd: JDAnalysis | null }) {
  return <aside className="hidden border-l border-[#e0e5e0] bg-[#f0f3ef] px-5 py-8 lg:block"><div className="sticky top-[104px] space-y-4"><section className="rounded-[22px] border border-[#dce3dc] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-extrabold uppercase tracking-[.13em] text-[#7e8a83]">Career Profile</p><CircleUserRound size={18} className="text-[#698174]" /></div><div className="mt-5 flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-[#dfece1] text-sm font-black text-[#315d47]">{profile.basics.name?.slice(0, 1) || "你"}</div><div className="min-w-0"><p className="truncate text-sm font-extrabold">{profile.basics.name || "等待认识你"}</p><p className="mt-0.5 truncate text-xs text-[#8a948f]">{profile.basics.targetRole || "目标岗位待填写"}</p></div></div><div className="mt-5"><div className="mb-2 flex justify-between text-xs"><span className="font-semibold text-[#78837d]">档案完整度</span><span className="font-extrabold text-[#37664f]">{completion}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf0ed]"><div className="h-full rounded-full bg-[#7db477] transition-[width] duration-700" style={{ width: `${completion}%` }} /></div></div><div className="mt-5 space-y-3"><ProfileLine icon={GraduationCap} label={profile.basics.school || "学校待补充"} /><ProfileLine icon={BriefcaseBusiness} label={profile.basics.major || "专业待补充"} /><ProfileLine icon={MapPin} label={profile.basics.location || "地点待补充"} /></div></section><section className="rounded-[22px] border border-[#dce3dc] bg-white p-5 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[.13em] text-[#7e8a83]">能力标签</p><div className="mt-4"><TagList items={profile.skills.length ? profile.skills : ["完成简历后生成"]} muted={!profile.skills.length} /></div></section>{jd && <section className="rounded-[22px] bg-[#dfeadf] p-5"><div className="flex gap-3"><div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-white/70 text-[#3d6c54]"><BriefcaseBusiness size={15} /></div><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#6d8376]">当前目标</p><p className="mt-1 text-sm font-extrabold text-[#294b3b]">{jd.jobTitle}</p><p className="mt-1 text-xs text-[#6c7c73]">{jd.company}</p></div></div></section>}</div></aside>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 flex items-center justify-between text-xs font-bold text-[#44524b]"><span>{label}</span>{hint && <span className="font-normal text-[#9aa29e]">{hint}</span>}</span><div className="field-control">{children}</div></label>; }
function SubmitButton({ loading, label }: { loading: boolean; label: string }) { return <button disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173c30] px-5 py-3 text-xs font-extrabold text-white shadow-md shadow-[#173c30]/10 transition hover:-translate-y-0.5 hover:bg-[#23513f] disabled:translate-y-0 disabled:opacity-60">{loading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={15} />}{loading ? "Agent 正在处理…" : label}<ArrowRight size={14} /></button>; }
function ResultBlock({ title, children }: { title: string; children: React.ReactNode }) { return <div className="border-t border-[#e5eae5] bg-[#f8faf7] p-6 md:p-7"><div className="mb-5 flex items-center gap-2"><div className="grid size-6 place-items-center rounded-full bg-[#dcebdc] text-[#407054]"><Check size={13} strokeWidth={3} /></div><h3 className="text-sm font-extrabold">{title}</h3></div>{children}</div>; }
function InfoList({ title, items, positive, numbered }: { title: string; items: string[]; positive?: boolean; numbered?: boolean }) { return <div><p className="mb-3 text-xs font-extrabold text-[#43544c]">{title}</p>{items.length ? <ul className="space-y-2.5">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2.5 text-xs leading-5 text-[#66736c]"><span className={`mt-1 grid size-4 shrink-0 place-items-center rounded-full text-xs font-bold ${positive ? "bg-[#dceedd] text-[#3f7650]" : "bg-[#e9ede9] text-[#6d7872]"}`}>{numbered ? index + 1 : positive ? "✓" : "·"}</span><span>{item}</span></li>)}</ul> : <p className="text-xs text-[#9aa29e]">暂无</p>}</div>; }
function TagList({ items, muted }: { items: string[]; muted?: boolean }) { return <div className="flex flex-wrap gap-2">{items.map((item) => <span key={item} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${muted ? "border-[#e3e7e3] bg-[#f5f6f5] text-[#a3aaa6]" : "border-[#d9e5db] bg-[#edf5ee] text-[#416a53]"}`}>{item}</span>)}</div>; }
function ReadyCard({ ready, title, detail, action }: { ready: boolean; title: string; detail: string; action: () => void }) { return <button onClick={action} className="flex items-center gap-3 rounded-2xl border border-[#e0e5e0] p-4 text-left hover:bg-[#f8faf8]"><div className={`grid size-9 place-items-center rounded-xl ${ready ? "bg-[#dfeee0] text-[#447452]" : "bg-[#f0f1f0] text-[#9ba39e]"}`}>{ready ? <CheckCircle2 size={17} /> : <span className="text-xs font-bold">!</span>}</div><div className="min-w-0 flex-1"><p className="text-xs font-extrabold">{title}</p><p className="mt-1 truncate text-xs text-[#89928d]">{detail}</p></div><ChevronRight size={15} className="text-[#a7afaa]" /></button>; }
function ScoreRing({ score }: { score: number }) { return <div className="relative grid size-24 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#a9dc7c ${score * 3.6}deg, rgba(255,255,255,.12) 0)` }}><div className="grid size-[76px] place-items-center rounded-full bg-[#173c30]"><span className="text-2xl font-black">{score}<small className="text-xs text-white/50">%</small></span></div></div>; }
function ProfileLine({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string }) { return <div className="flex items-center gap-2.5 text-xs text-[#727e77]"><Icon size={14} className="shrink-0 text-[#83968b]" /><span className="truncate">{label}</span></div>; }
function MarkdownResume({ content }: { content: string }) { return <div className="rounded-2xl border border-[#e0e5e0] bg-white p-5 text-xs leading-6 text-[#536159] whitespace-pre-wrap">{content}</div>; }
