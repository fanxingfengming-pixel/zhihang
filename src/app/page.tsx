import { ArrowRight, BriefcaseBusiness, ClipboardCheck, FileText, Mic2, Sparkles } from "lucide-react";
import Link from "next/link";
import { AppShell, ProgressLine } from "@/components/ui/app-shell";
import { BrandArt } from "@/components/ui/brand-art";
import { HomeRecommendedJobs } from "@/components/home-recommended-jobs";

export default function Home() {
  const metrics = [
    { value: "82", label: "简历评分", icon: FileText },
    { value: "12", label: "匹配岗位", icon: BriefcaseBusiness },
    { value: "3", label: "投递记录", icon: ClipboardCheck },
    { value: "--", label: "面试练习", icon: Mic2 },
  ];

  return (
    <AppShell>
      <section className="home-hero">
        <div className="home-welcome">
          <p className="eyebrow">SUNDAY · SEPTEMBER 06</p>
          <h1>你好，<br /><em>李同学。</em></h1>
          <p className="handwritten">Keep moving toward your offer.</p>
          <p className="hero-lead">距离理想 Offer，<br />再近一步。</p>
          <div className="readiness">
            <div><span>求职准备度</span><strong>68<small>%</small></strong></div>
            <ProgressLine value={68} />
            <p>比上周提升 6%，目前超过同阶段 72% 的同学</p>
          </div>
        </div>
        <BrandArt />
      </section>

      <section className="home-focus-grid">
        <article className="current-task">
          <div className="section-kicker"><span>CURRENT TASK</span><small>01 / 03</small></div>
          <div className="task-body">
            <span className="task-number">01</span>
            <div><h2>完善项目经历</h2><p>让招聘者更快看见你的真实贡献，预计可提升岗位匹配度 15%。</p></div>
            <Link href="/workspace?mode=build" className="circle-arrow" aria-label="通过对话完善简历"><ArrowRight size={20} /></Link>
          </div>
        </article>
        <article className="daily-advice">
          <Sparkles size={18} />
          <div><span>TODAY&apos;S ADVICE</span><p>你的项目经历还有 <b>3 处</b>可以进一步量化。</p><Link href="/workspace">查看 AI 建议 <ArrowRight size={14} /></Link></div>
        </article>
      </section>

      <section className="metric-strip" aria-label="求职数据概览">
        {metrics.map(({ value, label, icon: Icon }) => <div key={label}><Icon size={18} /><p><strong>{value}</strong><span>{label}</span></p></div>)}
      </section>

      <section className="home-jobs">
        <div className="section-title-row"><div><p className="eyebrow">FOR YOU</p><h2>适合你的机会</h2></div><Link href="/jobs">查看全部岗位 <ArrowRight size={15} /></Link></div>
        <HomeRecommendedJobs />
      </section>
    </AppShell>
  );
}
