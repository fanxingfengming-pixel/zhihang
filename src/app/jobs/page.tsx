"use client";

import { ArrowRight, Bookmark, BriefcaseBusiness, Check, Clock3, MapPin, Mic2, RefreshCw, Search, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell, PageHeading, ProgressLine } from "@/components/ui/app-shell";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { runJobAnalysis, type JobAnalysisResult } from "@/lib/job-analysis";
import { jobs, type Job } from "@/lib/ui-data";

export default function JobsPage() {
  return <Suspense fallback={<div className="route-loading">正在整理岗位匹配结果…</div>}><JobsContent /></Suspense>;
}

function JobsContent() {
  const params = useSearchParams();
  const initialId = params.get("job");
  const [selectedId, setSelectedId] = useState(jobs.some((job) => job.id === initialId) ? initialId! : jobs[0].id);
  const [saved, setSaved] = useState<string[]>([]);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState("match");
  const profile = useCareerProfile();
  const [analyses, setAnalyses] = useState<Record<string, JobAnalysisResult>>({});
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const visibleJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = jobs.filter((item) => {
      const matchesQuery = !normalized || [item.company, item.role, ...item.tags].join(" ").toLowerCase().includes(normalized);
      const matchesLocation = location === "all" || (location === "hzsh" && /杭州|上海/.test(item.location)) || (location === "sz" && item.location.includes("深圳"));
      return matchesQuery && matchesLocation;
    });
    const currentScore = (jobId: string) => analyses[jobId]?.profileUpdatedAt === profile.updatedAt ? analyses[jobId].match.score : -1;
    return sort === "match"
      ? filtered.toSorted((a, b) => currentScore(b.id) - currentScore(a.id))
      : filtered.toSorted((a, b) => a.posted.localeCompare(b.posted));
  }, [analyses, location, profile.updatedAt, query, sort]);
  const job = visibleJobs.find((item) => item.id === selectedId) ?? visibleJobs[0];
  const analysisKey = job ? `${job.id}:${profile.updatedAt}` : "";
  const storedAnalysis = job ? analyses[job.id] : undefined;
  const analysis = storedAnalysis?.profileUpdatedAt === profile.updatedAt ? storedAnalysis : undefined;
  const analysisError = errors[analysisKey];
  const analyzing = Boolean(job && analyzingId === job.id);

  const analyze = useCallback(async (candidate: Job, force = false) => {
    const errorKey = `${candidate.id}:${profile.updatedAt}`;
    setAnalyzingId(candidate.id);
    setErrors((current) => ({ ...current, [errorKey]: "" }));
    try {
      const result = await runJobAnalysis(candidate, profile, force);
      setAnalyses((current) => ({ ...current, [candidate.id]: result }));
    } catch (error) {
      setErrors((current) => ({ ...current, [errorKey]: error instanceof Error ? error.message : "岗位分析失败" }));
    } finally {
      setAnalyzingId((current) => current === candidate.id ? null : current);
    }
  }, [profile]);

  useEffect(() => {
    if (job && !analysis && analyzingId !== job.id && !analysisError) void analyze(job);
  }, [analysis, analysisError, analyze, analyzingId, job]);

  function toggleSaved(id: string) {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <AppShell>
      <PageHeading eyebrow="OPPORTUNITY MATCH" title="发现适合你的岗位" description="选择岗位后，JD 解析与岗位匹配 Agent 会依据同一份 Career Profile 生成分析。" action={<button className="secondary-button" onClick={() => job && void analyze(job, true)} disabled={!job || analyzing}><RefreshCw size={15} className={analyzing ? "spin" : ""} />{analyzing ? "正在分析…" : "重新分析当前岗位"}</button>} />
      {analysis ? <p className="page-feedback" role="status"><Sparkles size={13} />已由{analysis.meta.demo ? "演示引擎" : analysis.meta.provider}完成 JD 解析与匹配分析</p> : null}
      <section className="jobs-workbench">
        <aside className="job-list-panel">
          <div className="job-search"><Search size={16} /><input aria-label="搜索岗位" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="公司、岗位或技能" /></div>
          <div className="job-filters">
            <select aria-label="筛选城市" value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">全部城市</option><option value="hzsh">杭州 / 上海</option><option value="sz">深圳</option></select>
            <select aria-label="排序方式" value={sort} onChange={(event) => setSort(event.target.value)}><option value="match">匹配度优先</option><option value="latest">最近更新</option></select>
          </div>
          <p className="list-count"><span>推荐岗位</span><b>{visibleJobs.length} RESULTS</b></p>
          <div className="job-list">
            {visibleJobs.map((item) => {
              const itemAnalysis = analyses[item.id];
              const score = itemAnalysis?.profileUpdatedAt === profile.updatedAt ? itemAnalysis.match.score : undefined;
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
            <button className={`bookmark ${saved.includes(job.id) ? "saved" : ""}`} onClick={() => toggleSaved(job.id)} aria-label={saved.includes(job.id) ? "取消收藏岗位" : "收藏岗位"}><Bookmark size={18} fill={saved.includes(job.id) ? "currentColor" : "none"} /></button>
          </div>
          <div className="jd-tags">{(analysis?.jd.keywords.length ? analysis.jd.keywords : job.tags).map((tag) => <span key={tag}>{tag}</span>)}</div>
          <p className="jd-summary">{analysis?.jd.summary || job.summary}</p>
          <div className="jd-section"><h3>岗位职责</h3><ol>{(analysis?.jd.responsibilities.length ? analysis.jd.responsibilities : job.responsibilities).map((item, index) => <li key={`${item}-${index}`}><span>0{index + 1}</span>{item}</li>)}</ol></div>
          <div className="jd-section"><h3>任职要求</h3><ol>{(analysis ? [...analysis.jd.requiredSkills, ...analysis.jd.preferredSkills] : job.requirements).map((item, index) => <li key={`${item}-${index}`}><span>0{index + 1}</span>{item}</li>)}</ol></div>
        </article>

        <aside className="match-panel">
          <div className="match-head"><p><Sparkles size={15} />AI MATCH REPORT</p><span>基于共享 Career Profile</span></div>
          {analyzing && !analysis ? <AnalysisState icon={<RefreshCw size={22} className="spin" />} title="正在分析当前岗位" description="JD 解析完成后会自动进行证据化匹配。" /> : null}
          {analysisError && !analysis ? <AnalysisState icon={<TriangleAlert size={22} />} title="分析暂未完成" description={analysisError} action={() => void analyze(job, true)} /> : null}
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
            <Link className="primary-button full" href={`/workspace?job=${job.id}`}>针对该岗位优化简历 <ArrowRight size={16} /></Link>
            <Link className="interview-entry-link" href={`/interview?job=${job.id}`}><Mic2 size={15} />开始岗位模拟面试 <ArrowRight size={14} /></Link>
            <small className="match-note">匹配度用于发现优势与差距，不代表录用概率。</small>
          </> : null}
        </aside></> : <article className="job-detail-empty"><Search size={24} /><h2>换个条件继续找</h2><p>当前筛选下没有岗位，清除关键词或更换城市后即可查看详情与匹配分析。</p><button className="secondary-button" onClick={() => { setQuery(""); setLocation("all"); }}>查看全部岗位</button></article>}
      </section>
    </AppShell>
  );
}

function AnalysisState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: () => void }) {
  return <div className="analysis-empty">{icon}<h3>{title}</h3><p>{description}</p>{action ? <button className="secondary-button" onClick={action}>重试分析</button> : null}</div>;
}
