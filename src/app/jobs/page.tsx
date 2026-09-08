"use client";

import { ArrowRight, Bookmark, BriefcaseBusiness, Check, ClipboardCheck, Clock3, MapPin, Mic2, Plus, RefreshCw, Search, Sparkles, Trash2, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AppShell, PageHeading, ProgressLine } from "@/components/ui/app-shell";
import { AgentTrace, type AgentTraceStep } from "@/components/ui/agent-trace";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { useApplications } from "@/hooks/use-applications";
import { useCustomJobs } from "@/hooks/use-custom-jobs";
import { useJobAnalysis, useJobAnalysisScores } from "@/hooks/use-job-analysis";
import { useSavedJobs } from "@/hooks/use-saved-jobs";
import { runAgent } from "@/lib/agent-client";
import { saveApplications } from "@/lib/application-store";
import { removeCustomJob, saveCustomJob } from "@/lib/custom-job-store";
import { runJobAnalysis, saveCachedJobAnalysis, type JobAnalysisResult, type JobAnalysisStage } from "@/lib/job-analysis";
import type { JDAnalysis, MatchReport } from "@/lib/schemas";
import { saveSavedJobs } from "@/lib/saved-job-store";
import { jobs, type Job } from "@/lib/ui-data";

export default function JobsPage() {
  return <Suspense fallback={<div className="route-loading">正在整理岗位匹配结果…</div>}><JobsContent /></Suspense>;
}

function jobRecency(job: Job) {
  if (job.createdAt) return Date.parse(job.createdAt) || 0;
  if (/今天|刚刚/.test(job.posted)) return 1;
  const daysAgo = Number(job.posted.match(/(\d+)\s*天前/)?.[1]);
  return Number.isFinite(daysAgo) ? -daysAgo : Number.NEGATIVE_INFINITY;
}

function JobsContent() {
  const params = useSearchParams();
  const initialId = params.get("job");
  const [selectedId, setSelectedId] = useState(initialId || jobs[0].id);
  const saved = useSavedJobs();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState("match");
  const profile = useCareerProfile();
  const applications = useApplications();
  const customJobs = useCustomJobs();
  const [jdDialogOpen, setJdDialogOpen] = useState(false);
  const [jdText, setJdText] = useState("");
  const [jdImporting, setJdImporting] = useState(false);
  const [jdImportError, setJdImportError] = useState("");
  const [addedJobId, setAddedJobId] = useState("");
  const [analysisStage, setAnalysisStage] = useState<JobAnalysisStage | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [transientAnalyses, setTransientAnalyses] = useState<Record<string, JobAnalysisResult>>({});

  const allJobs = useMemo(() => [...customJobs, ...jobs], [customJobs]);
  const cachedAnalysisScores = useJobAnalysisScores(allJobs.map((item) => item.id), profile.updatedAt);
  const analysisScores = useMemo(() => {
    const scores = { ...cachedAnalysisScores };
    for (const result of Object.values(transientAnalyses)) {
      if (result.profileUpdatedAt === profile.updatedAt) scores[result.jobId] = result.match.score;
    }
    return scores;
  }, [cachedAnalysisScores, profile.updatedAt, transientAnalyses]);
  const visibleJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = allJobs.filter((item) => {
      const matchesQuery = !normalized || [item.company, item.role, ...item.tags].join(" ").toLowerCase().includes(normalized);
      const matchesLocation = location === "all" || (location === "hzsh" && /杭州|上海/.test(item.location)) || (location === "sz" && item.location.includes("深圳"));
      return matchesQuery && matchesLocation;
    });
    const currentScore = (jobId: string) => analysisScores[jobId] ?? -1;
    return sort === "match"
      ? filtered.toSorted((a, b) => currentScore(b.id) - currentScore(a.id))
      : filtered.toSorted((a, b) => jobRecency(b) - jobRecency(a));
  }, [allJobs, analysisScores, location, query, sort]);
  const job = visibleJobs.find((item) => item.id === selectedId) ?? visibleJobs[0];
  const analysisKey = job ? `${job.id}:${profile.updatedAt}` : "";
  const cachedAnalysis = useJobAnalysis(job?.id || "", profile.updatedAt);
  const transientAnalysis = job ? transientAnalyses[`${job.id}:${profile.updatedAt}`] : undefined;
  const analysis = transientAnalysis || cachedAnalysis;
  const analysisError = errors[analysisKey];
  const analyzing = Boolean(job && analyzingId === job.id);

  const analyze = useCallback(async (candidate: Job, force = false) => {
    const errorKey = `${candidate.id}:${profile.updatedAt}`;
    setAnalyzingId(candidate.id);
    setErrors((current) => ({ ...current, [errorKey]: "" }));
    try {
      const result = await runJobAnalysis(candidate, profile, force, setAnalysisStage);
      setTransientAnalyses((current) => ({ ...current, [errorKey]: result }));
    } catch (error) {
      setErrors((current) => ({ ...current, [errorKey]: error instanceof Error ? error.message : "岗位分析失败" }));
    } finally {
      setAnalyzingId((current) => current === candidate.id ? null : current);
      setAnalysisStage(null);
    }
  }, [profile]);

  function toggleSaved(id: string) {
    saveSavedJobs(saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id]);
  }

  function deleteCustomJob(candidate: Job) {
    if (!candidate.id.startsWith("custom-")) return;
    if (!window.confirm(`删除“${candidate.company} · ${candidate.role}”及其本机 JD？已加入投递中心的记录不会删除。`)) return;
    if (!removeCustomJob(candidate.id)) return;
    saveSavedJobs(saved.filter((id) => id !== candidate.id));
    setSelectedId(jobs[0].id);
  }

  async function importJD(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const source = jdText.trim();
    if (source.length < 30 || jdImporting) return;
    setJdImporting(true);
    setJdImportError("");
    try {
      setAnalysisStage("jd");
      const jdResponse = await runAgent<JDAnalysis>("jd", source);
      setAnalysisStage("match");
      const matchResponse = await runAgent<MatchReport>("match", { targetJob: jdResponse.data.jobTitle, company: jdResponse.data.company }, { profile, jd: jdResponse.data });
      const createdAt = new Date().toISOString();
      const id = `custom-${crypto.randomUUID()}`;
      const customJob: Job = {
        id,
        company: jdResponse.data.company || "自定义公司",
        role: jdResponse.data.jobTitle || "自定义岗位",
        location: "自定义 JD",
        salary: "未注明",
        match: matchResponse.data.score,
        initials: (jdResponse.data.company || jdResponse.data.jobTitle || "岗").slice(0, 1),
        posted: "刚刚导入",
        createdAt,
        sourceText: source,
        tags: jdResponse.data.keywords,
        summary: jdResponse.data.summary,
        responsibilities: jdResponse.data.responsibilities,
        requirements: [...jdResponse.data.requiredSkills, ...jdResponse.data.preferredSkills],
        scores: [
          { label: "技能", value: matchResponse.data.dimensions.skills },
          { label: "项目", value: matchResponse.data.dimensions.projects },
          { label: "专业", value: matchResponse.data.dimensions.education },
          { label: "经历", value: matchResponse.data.dimensions.experience },
        ],
        strengths: matchResponse.data.matchedSkills,
        gaps: matchResponse.data.gaps,
      };
      const result: JobAnalysisResult = {
        jobId: id,
        jd: jdResponse.data,
        match: matchResponse.data,
        meta: { provider: matchResponse.meta.provider, demo: jdResponse.meta.demo || matchResponse.meta.demo },
        profileUpdatedAt: profile.updatedAt,
      };
      if (!saveCustomJob(customJob)) throw new Error("浏览器无法保存这份 JD，请检查存储权限后重试。");
      saveCachedJobAnalysis(result);
      setTransientAnalyses((current) => ({ ...current, [`${id}:${profile.updatedAt}`]: result }));
      setSelectedId(id);
      setQuery("");
      setLocation("all");
      setJdDialogOpen(false);
      setJdText("");
    } catch (error) {
      setJdImportError(error instanceof Error ? error.message : "JD 导入失败");
    } finally {
      setJdImporting(false);
      setAnalysisStage(null);
    }
  }

  function addToApplications(candidate: Job) {
    if (applications.some((item) => item.jobId === candidate.id && item.stage !== "closed")) {
      setAddedJobId(candidate.id);
      return;
    }
    const savedSuccessfully = saveApplications([...applications, {
      id: `application-${Date.now()}`,
      company: candidate.company,
      role: candidate.role,
      jobId: candidate.id,
      stage: "interested",
      nextAction: "核对岗位要求并准备定向材料",
      deadline: "",
      notes: candidate.id.startsWith("custom-") ? "来自手动粘贴的 JD" : "来自岗位匹配页面",
      updatedAt: new Date().toISOString(),
    }]);
    if (!savedSuccessfully) return;
    setAddedJobId(candidate.id);
  }

  const jobAnalysisSteps: AgentTraceStep[] = [
    { id: "jd", label: "JD 解析 Agent", description: "提取职责、要求与关键词", source: "岗位原文", status: analysis ? "completed" : analysisStage === "jd" ? "running" : analysisStage === "match" ? "completed" : analysisError ? "error" : "waiting" },
    { id: "match", label: "岗位匹配 Agent", description: "基于证据计算优势与差距", source: "结构化 JD + Career Profile", status: analysis ? "completed" : analysisStage === "match" ? "running" : analysisError ? "error" : "waiting" },
  ];

  return (
    <AppShell>
      <PageHeading eyebrow="OPPORTUNITY MATCH" title="发现适合你的岗位" description="选择预置岗位，或粘贴你找到的真实 JD；只有点击分析后才会调用模型。" action={<div className="jobs-heading-actions"><button className="secondary-button" onClick={() => setJdDialogOpen(true)}><Plus size={15} />粘贴真实 JD</button><button className="secondary-button" onClick={() => job && void analyze(job, Boolean(analysis))} disabled={!job || analyzing}><RefreshCw size={15} className={analyzing ? "spin" : ""} />{analyzing ? "正在分析…" : analysis ? "重新分析当前岗位" : "分析当前岗位"}</button></div>} />
      {analysis ? <p className="page-feedback" role="status"><Sparkles size={13} />已由{analysis.meta.demo ? "演示引擎" : analysis.meta.provider}完成 JD 解析与匹配分析</p> : null}
      {job && addedJobId === job.id ? <p className="page-feedback" role="status"><Check size={13} />已加入投递中心，可继续记录准备、投递和面试进度</p> : null}
      <section className="jobs-workbench">
        <aside className="job-list-panel">
          <div className="job-search"><Search size={16} aria-hidden="true" /><input name="job-search" aria-label="搜索岗位" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" placeholder="公司、岗位或技能…" /></div>
          <div className="job-filters">
            <select aria-label="筛选城市" value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">全部城市</option><option value="hzsh">杭州 / 上海</option><option value="sz">深圳</option></select>
            <select aria-label="排序方式" value={sort} onChange={(event) => setSort(event.target.value)}><option value="match">匹配度优先</option><option value="latest">最近更新</option></select>
          </div>
          <p className="list-count"><span>推荐岗位</span><b>{visibleJobs.length} RESULTS</b></p>
          <div className="job-list">
            {visibleJobs.map((item) => {
              const score = analysisScores[item.id];
              return <button key={item.id} className={job?.id === item.id ? "selected" : ""} onClick={() => setSelectedId(item.id)}>
                <span className="company-mark">{item.initials}</span>
                <div><h3>{item.company}</h3><p>{item.role}</p><small><MapPin size={12} />{item.location}</small></div>
                <strong>{score === undefined ? "—" : `${score}%`}</strong>
              </button>;
            })}
            {visibleJobs.length === 0 ? <div className="job-empty"><Search size={18} /><p>没有匹配结果</p><button onClick={() => { setQuery(""); setLocation("all"); }}>清除筛选</button></div> : null}
          </div>
        </aside>

        {job ? <><article className="jd-panel">
          <div className="jd-heading">
            <div><div className="company-line"><span className="company-mark large">{job.initials}</span><p><small>{analysis?.jd.company || job.company}</small><b>{analysis?.jd.jobTitle || job.role}</b></p></div><div className="job-meta"><span><MapPin size={14} />{job.location}</span><span><BriefcaseBusiness size={14} />{job.salary}</span><span><Clock3 size={14} />{job.posted}</span></div></div>
            <div className="jd-heading-actions">{job.id.startsWith("custom-") ? <button className="bookmark danger" onClick={() => deleteCustomJob(job)} aria-label="删除自定义岗位"><Trash2 size={17} /></button> : null}<button className={`bookmark ${saved.includes(job.id) ? "saved" : ""}`} onClick={() => toggleSaved(job.id)} aria-label={saved.includes(job.id) ? "取消收藏岗位" : "收藏岗位"}><Bookmark size={18} fill={saved.includes(job.id) ? "currentColor" : "none"} /></button></div>
          </div>
          <div className="jd-tags">{(analysis?.jd.keywords.length ? analysis.jd.keywords : job.tags).map((tag) => <span key={tag}>{tag}</span>)}</div>
          <p className="jd-summary">{analysis?.jd.summary || job.summary}</p>
          <div className="jd-section"><h3>岗位职责</h3><ol>{(analysis?.jd.responsibilities.length ? analysis.jd.responsibilities : job.responsibilities).map((item, index) => <li key={`${item}-${index}`}><span>0{index + 1}</span>{item}</li>)}</ol></div>
          <div className="jd-section"><h3>任职要求</h3><ol>{(analysis ? [...analysis.jd.requiredSkills, ...analysis.jd.preferredSkills] : job.requirements).map((item, index) => <li key={`${item}-${index}`}><span>0{index + 1}</span>{item}</li>)}</ol></div>
        </article>

        <aside className="match-panel">
          <div className="match-head"><p><Sparkles size={15} />AI MATCH REPORT</p><span>基于共享 Career Profile</span></div>
          {(analyzing || analysis) ? <AgentTrace title="岗位分析协作链" steps={jobAnalysisSteps} /> : null}
          {analyzing && !analysis ? <AnalysisState icon={<RefreshCw size={22} className="spin" />} title="正在分析当前岗位" description="JD 解析完成后会自动进行证据化匹配。" /> : null}
          {analysisError && !analysis ? <AnalysisState icon={<TriangleAlert size={22} />} title="分析暂未完成" description={analysisError} action={() => void analyze(job, true)} /> : null}
          {!analyzing && !analysis && !analysisError ? <AnalysisState icon={<Sparkles size={22} />} title="等待开始分析" description="点击后将调用 JD 解析与岗位匹配 Agent；进入页面本身不会产生模型费用。" action={() => void analyze(job)} /> : null}
          {analysis ? <>
            <div className="match-score"><strong>{analysis.match.score}<small>%</small></strong><div><h2>综合匹配度</h2><p>{analysis.match.verdict}</p></div></div>
            <div className="score-list">{[
              { label: "技能", value: analysis.match.dimensions.skills },
              { label: "项目", value: analysis.match.dimensions.projects },
              { label: "专业", value: analysis.match.dimensions.education },
              { label: "经历", value: analysis.match.dimensions.experience },
            ].map((score) => <div key={score.label}><p><span>{score.label}</span><b>{score.value}%</b></p><ProgressLine value={score.value} compact /></div>)}</div>
            <div className="match-insights positive"><h3><Check size={15} />你的优势</h3>{(analysis.match.matchedSkills.length ? analysis.match.matchedSkills : analysis.match.evidence).map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}</div>
            <div className="match-insights gap"><h3><TriangleAlert size={15} />仍有差距</h3>{analysis.match.gaps.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}</div>
            <button className="secondary-button full application-entry-button" onClick={() => addToApplications(job)}><ClipboardCheck size={15} />{addedJobId === job.id ? "已加入投递中心" : "加入投递中心"}</button>
            <Link className="primary-button full" href={`/workspace?job=${job.id}`}>针对该岗位优化简历 <ArrowRight size={16} /></Link>
            <Link className="interview-entry-link" href={`/interview?job=${job.id}`}><Mic2 size={15} />开始岗位模拟面试 <ArrowRight size={14} /></Link>
            <small className="match-note">匹配度用于发现优势与差距，不代表录用概率。</small>
          </> : null}
        </aside></> : <article className="job-detail-empty"><Search size={24} /><h2>换个条件继续找</h2><p>当前筛选下没有岗位，清除关键词或更换城市后即可查看详情与匹配分析。</p><button className="secondary-button" onClick={() => { setQuery(""); setLocation("all"); }}>查看全部岗位</button></article>}
      </section>
      {jdDialogOpen ? <div className="dialog-backdrop" role="presentation"><form className="jd-import-dialog" role="dialog" aria-modal="true" aria-labelledby="jd-import-title" onSubmit={importJD}>
        <div className="dialog-title"><div><p className="eyebrow">CUSTOM JOB DESCRIPTION</p><h2 id="jd-import-title">粘贴真实 JD</h2></div><button type="button" onClick={() => setJdDialogOpen(false)} aria-label="关闭 JD 导入"><X size={18} /></button></div>
        <p>请粘贴公司、岗位职责和任职要求。系统不会自动投递，也不会保存招聘网站账号信息。</p>
        <label>JD 原文<textarea name="jd-text" value={jdText} onChange={(event) => setJdText(event.target.value)} autoComplete="off" placeholder="例如：公司名称、岗位名称、岗位职责、任职要求……" minLength={30} required /></label>
        <small>{jdText.length} 字 · 建议保留完整职责与要求</small>
        {jdImportError ? <div className="application-error"><TriangleAlert size={14} />{jdImportError}</div> : null}
        <div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setJdDialogOpen(false)}>取消</button><button type="submit" className="primary-button" disabled={jdText.trim().length < 30 || jdImporting}>{jdImporting ? <><RefreshCw size={14} className="spin" />JD 与匹配 Agent 正在协作…</> : <><Sparkles size={14} />解析并匹配</>}</button></div>
      </form></div> : null}
    </AppShell>
  );
}

function AnalysisState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: () => void }) {
  return <div className="analysis-empty">{icon}<h3>{title}</h3><p>{description}</p>{action ? <button className="secondary-button" onClick={action}>重试分析</button> : null}</div>;
}
