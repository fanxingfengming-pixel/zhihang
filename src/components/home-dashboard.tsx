"use client";

import { ArrowRight, BriefcaseBusiness, ClipboardCheck, FileText, Mic2, Sparkles } from "lucide-react";
import Link from "next/link";
import { HomeRecommendedJobs } from "@/components/home-recommended-jobs";
import { BrandArt } from "@/components/ui/brand-art";
import { AppShell, ProgressLine } from "@/components/ui/app-shell";
import { useApplications } from "@/hooks/use-applications";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { useInterviewHistory } from "@/hooks/use-insight-history";
import { calculateProfileCompletion, countProjectsMissingResults } from "@/lib/career-profile-metrics";

export function HomeDashboard() {
  const profile = useCareerProfile();
  const applications = useApplications();
  const interviewHistory = useInterviewHistory();
  const completion = calculateProfileCompletion(profile);
  const projectsMissingResults = countProjectsMissingResults(profile);
  const activeApplications = applications.filter((item) => item.stage !== "closed" && !item.notes.includes("示例记录")).length;
  const displayName = profile.basics.name.trim() || "同学";
  const metrics = [
    { value: `${completion}%`, label: "档案完整度", icon: FileText },
    { value: String(profile.projects.length), label: "项目经历", icon: BriefcaseBusiness },
    { value: String(activeApplications), label: "真实投递", icon: ClipboardCheck },
    { value: String(interviewHistory.length), label: "面试练习", icon: Mic2 },
  ];
  const needsProfile = completion < 100;
  const task = needsProfile
    ? { title: "完善求职档案", copy: "补齐真实经历与目标岗位，让后续 Agent 获得更完整的分析依据。", href: "/workspace?mode=build", label: "通过对话完善求职档案" }
    : { title: "分析目标岗位", copy: "求职档案已经完整，可以选择岗位并开始 JD 解析与匹配分析。", href: "/jobs", label: "前往岗位匹配" };
  const advice = projectsMissingResults > 0
    ? `有 ${projectsMissingResults} 段项目经历还没有填写成果，可继续补充真实、可核实的结果。`
    : profile.projects.length
      ? "项目经历已包含成果信息。下一步可针对目标岗位生成定向优化建议。"
      : "还没有项目经历。课程设计、竞赛、社团和个人作品都可以成为有效素材。";

  return (
    <AppShell>
      <section className="home-hero">
        <div className="home-welcome">
          <p className="eyebrow">今日求职进度</p>
          <h1>你好，<br /><em>{displayName}。</em></h1>
          <p className="handwritten">Keep moving toward your offer.</p>
          <p className="hero-lead">距离理想 Offer，<br />再近一步。</p>
          <div className="readiness">
            <div><span>求职档案完整度</span><strong>{completion}<small>%</small></strong></div>
            <ProgressLine value={completion} />
            <p>已记录 {profile.skills.length} 项技能、{profile.projects.length} 段项目经历；数据仅依据你的求职档案计算。</p>
          </div>
        </div>
        <BrandArt />
      </section>

      <section className="home-focus-grid">
        <article className="current-task">
          <div className="section-kicker"><span>CURRENT TASK</span><small>{needsProfile ? "01 / 03" : "02 / 03"}</small></div>
          <div className="task-body">
            <span className="task-number">{needsProfile ? "01" : "02"}</span>
            <div><h2>{task.title}</h2><p>{task.copy}</p></div>
            <Link href={task.href} className="circle-arrow" aria-label={task.label}><ArrowRight size={20} /></Link>
          </div>
        </article>
        <article className="daily-advice">
          <Sparkles size={18} aria-hidden="true" />
          <div><span>TODAY&apos;S ADVICE</span><p>{advice}</p><Link href="/workspace">查看并完善 <ArrowRight size={14} /></Link></div>
        </article>
      </section>

      <section className="metric-strip" aria-label="求职数据概览">
        {metrics.map(({ value, label, icon: Icon }) => <div key={label}><Icon size={18} aria-hidden="true" /><p><strong>{value}</strong><span>{label}</span></p></div>)}
      </section>

      <section className="home-jobs">
        <div className="section-title-row"><div><p className="eyebrow">FOR YOU</p><h2>适合你的机会</h2></div><Link href="/jobs">查看全部岗位 <ArrowRight size={15} /></Link></div>
        <HomeRecommendedJobs />
      </section>
    </AppShell>
  );
}
