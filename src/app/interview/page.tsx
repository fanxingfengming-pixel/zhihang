"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  MessageSquareText,
  Mic2,
  RefreshCw,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppShell, PageHeading, ProgressLine } from "@/components/ui/app-shell";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { useCustomJobs } from "@/hooks/use-custom-jobs";
import { useJobAnalysis } from "@/hooks/use-job-analysis";
import { useInterviewHistory } from "@/hooks/use-insight-history";
import { runAgent, type AgentMeta } from "@/lib/agent-client";
import { saveInterviewHistory } from "@/lib/insight-history-store";
import { runJobAnalysis, type JobAnalysisResult } from "@/lib/job-analysis";
import type { InterviewAgentResult, InterviewEvaluation, InterviewPreparation } from "@/lib/schemas";
import { jobs } from "@/lib/ui-data";

type InterviewSession = {
  preparation: InterviewPreparation;
  meta: AgentMeta;
};

export default function InterviewPage() {
  return <Suspense fallback={<div className="route-loading">正在准备面试训练室…</div>}><InterviewContent /></Suspense>;
}

function InterviewContent() {
  const params = useSearchParams();
  const router = useRouter();
  const profile = useCareerProfile();
  const customJobs = useCustomJobs();
  const allJobs = [...customJobs, ...jobs];
  const interviewHistory = useInterviewHistory();
  const initialId = params.get("job");
  const [selectedId, setSelectedId] = useState(initialId || jobs[0].id);
  const selectedJob = allJobs.find((job) => job.id === selectedId) ?? jobs[0];
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(null);
  const [loading, setLoading] = useState<"prepare" | "evaluate" | null>(null);
  const [error, setError] = useState("");
  const [transientAnalysis, setTransientAnalysis] = useState<JobAnalysisResult | null>(null);
  const cachedAnalysis = useJobAnalysis(selectedJob.id, profile.updatedAt);
  const analysis = transientAnalysis?.jobId === selectedJob.id && transientAnalysis.profileUpdatedAt === profile.updatedAt
    ? transientAnalysis
    : cachedAnalysis;
  const currentQuestion = session?.preparation.questions[currentIndex];

  function chooseJob(jobId: string) {
    setSelectedId(jobId);
    setSession(null);
    setCurrentIndex(0);
    setAnswer("");
    setEvaluation(null);
    setError("");
    setTransientAnalysis(null);
    router.replace(`/interview?job=${jobId}`);
  }

  async function prepareInterview() {
    if (loading) return;
    setLoading("prepare");
    setError("");
    setEvaluation(null);
    try {
      const readyAnalysis = analysis || await runJobAnalysis(selectedJob, profile);
      setTransientAnalysis(readyAnalysis);
      const response = await runAgent<InterviewAgentResult>("interview", {
        action: "prepare",
        targetJob: readyAnalysis.jd.jobTitle,
      }, { profile, jd: readyAnalysis.jd, match: readyAnalysis.match });
      if (response.data.action !== "prepare") throw new Error("面试 Agent 返回了错误的任务类型");
      setSession({ preparation: response.data, meta: response.meta });
      setCurrentIndex(0);
      setAnswer("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "面试题生成失败");
    } finally {
      setLoading(null);
    }
  }

  async function evaluateAnswer() {
    const cleanAnswer = answer.trim();
    if (!analysis || !currentQuestion || !cleanAnswer || loading) return;
    setLoading("evaluate");
    setError("");
    try {
      const response = await runAgent<InterviewAgentResult>("interview", {
        action: "evaluate",
        question: currentQuestion.question,
        questionIntent: currentQuestion.intent,
        answer: cleanAnswer,
      }, { profile, jd: analysis.jd, match: analysis.match });
      if (response.data.action !== "evaluate") throw new Error("面试 Agent 返回了错误的任务类型");
      setEvaluation(response.data);
      const savedPractice = saveInterviewHistory([{
        id: `practice-${Date.now()}`,
        jobId: selectedJob.id,
        jobTitle: analysis.jd.jobTitle,
        question: currentQuestion.question,
        answer: cleanAnswer,
        evaluation: response.data,
        meta: response.meta,
        createdAt: new Date().toISOString(),
      }, ...interviewHistory]);
      if (!savedPractice) throw new Error("浏览器无法保存本次练习，请检查存储权限后重试。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "回答评分失败");
    } finally {
      setLoading(null);
    }
  }

  function selectQuestion(index: number) {
    setCurrentIndex(index);
    setAnswer("");
    setEvaluation(null);
    setError("");
  }

  const status = analysis
    ? `${analysis.meta.demo ? "演示引擎" : analysis.meta.provider} · 匹配度 ${analysis.match.score}%`
    : "尚未分析；生成题目时会先完成岗位分析";

  return (
    <AppShell>
      <PageHeading
        eyebrow="AI INTERVIEW LAB"
        title="岗位模拟面试"
        description="从真实档案与目标 JD 出题，逐题作答并获得有证据的表达反馈。"
        action={(
          <label className="interview-job-select">
            <span>训练岗位</span>
            <select value={selectedJob.id} onChange={(event) => chooseJob(event.target.value)}>
              {allJobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.role}</option>)}
            </select>
          </label>
        )}
      />

      <section className="interview-workbench">
        <aside className="interview-brief">
          <p className="panel-label">INTERVIEW BRIEF</p>
          <div className="interview-target">
            <span className="company-mark large">{selectedJob.initials}</span>
            <div><small>{selectedJob.company}</small><b>{analysis?.jd.jobTitle || selectedJob.role}</b></div>
          </div>
          <div className="interview-status"><i /><span>{status}</span></div>

          <div className="interview-brief-block">
            <h3><Target size={14} />本轮重点</h3>
            {(session?.preparation.focusAreas || analysis?.match.gaps || selectedJob.tags).slice(0, 4).map((item, index) => (
              <p key={`${item}-${index}`}>{item}</p>
            ))}
          </div>
          <div className="interview-profile-proof">
            <span>共享档案证据</span>
            <strong>{profile.skills.length + profile.projects.length}<small> 项</small></strong>
            <p>{profile.basics.targetRole || "尚未设置目标岗位"}</p>
          </div>
          <div className="interview-history-mini"><span>最近训练</span>{interviewHistory.slice(0, 3).map((record) => <p key={record.id}><b>{Math.round(record.evaluation.evaluation.score)}</b><small>{record.jobTitle}</small></p>)}{interviewHistory.length === 0 ? <em>提交回答后自动保存在当前浏览器</em> : null}</div>
          <Link className="interview-back-link" href={`/jobs?job=${selectedJob.id}`}><ArrowLeft size={14} />返回岗位详情</Link>
        </aside>

        <article className="interview-room">
          {!session ? (
            <div className="interview-empty">
              <span><Mic2 size={28} /></span>
              <p className="eyebrow">READY WHEN YOU ARE</p>
              <h2>为当前岗位生成一轮定向面试</h2>
              <p>点击后会先准备岗位分析，再读取共享 Career Profile、结构化 JD 和匹配差距生成 5 道题；进入页面不会调用模型。</p>
              {error ? <div className="interview-inline-error"><TriangleAlert size={15} />{error}</div> : null}
              <button className="primary-button" onClick={() => void prepareInterview()} disabled={loading === "prepare"}>
                {loading === "prepare" ? <><RefreshCw className="spin" size={16} />正在准备岗位分析与题目…</> : <><Sparkles size={16} />生成面试题</>}
              </button>
              <small>{analysis ? "岗位分析已就绪" : "点击后将按需调用 JD、匹配与面试 Agent"}</small>
            </div>
          ) : (
            <>
              <header className="interview-room-head">
                <div><p className="eyebrow">LIVE SESSION</p><h2>{session.preparation.sessionTitle}</h2><span>{session.preparation.openingMessage}</span></div>
                <button className="text-button compact" onClick={() => void prepareInterview()} disabled={Boolean(loading)}><RefreshCw size={13} />换一组题</button>
              </header>
              <div className="question-pager" aria-label="面试题目列表">
                {session.preparation.questions.map((question, index) => (
                  <button key={question.id} className={index === currentIndex ? "active" : ""} onClick={() => selectQuestion(index)} aria-label={`第 ${index + 1} 题`}>
                    {String(index + 1).padStart(2, "0")}
                  </button>
                ))}
              </div>
              {currentQuestion ? (
                <div className="interview-question">
                  <div className="question-kicker"><span>QUESTION {String(currentIndex + 1).padStart(2, "0")}</span><small>{currentIndex + 1} / {session.preparation.questions.length}</small></div>
                  <h3>{currentQuestion.question}</h3>
                  <div className="question-intent"><CircleHelp size={15} /><p><b>面试官在考察什么</b><span>{currentQuestion.intent}</span></p></div>
                  <div className="answer-framework">
                    <p>建议回答结构</p>
                    <ol>{currentQuestion.answerFramework.map((item, index) => <li key={`${item}-${index}`}><span>{index + 1}</span>{item}</li>)}</ol>
                  </div>
                  <label className="answer-box">
                    <span>输入你的回答 <small>{answer.length} 字</small></span>
                    <textarea name="interview-answer" aria-label="输入你的回答" value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" placeholder="建议先完整作答，再查看 AI 反馈。请使用真实经历，不确定的数据不要编造。" />
                  </label>
                  {error ? <div className="interview-inline-error" role="alert"><TriangleAlert size={15} />{error}</div> : null}
                  <div className="interview-actions">
                    <button className="secondary-button" onClick={() => selectQuestion(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0 || Boolean(loading)}><ChevronLeft size={15} />上一题</button>
                    <button className="primary-button" onClick={() => void evaluateAnswer()} disabled={!answer.trim() || Boolean(loading)}>
                      {loading === "evaluate" ? <><RefreshCw className="spin" size={15} />正在分析回答…</> : <><MessageSquareText size={15} />提交回答并评分</>}
                    </button>
                    <button className="secondary-button" onClick={() => selectQuestion(Math.min(session.preparation.questions.length - 1, currentIndex + 1))} disabled={currentIndex === session.preparation.questions.length - 1 || Boolean(loading)}>下一题<ChevronRight size={15} /></button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </article>

        <aside className="interview-coach">
          <div className="interview-coach-head"><span><Sparkles size={16} /></span><div><b>AI 面试教练</b><small>{session ? `${session.meta.demo ? "演示引擎" : session.meta.provider} 已出题` : "等待开始训练"}</small></div></div>
          {evaluation ? (
            <EvaluationReport report={evaluation} />
          ) : (
            <div className="coach-placeholder">
              <p className="panel-label">ANSWER CHECKLIST</p>
              <h3>回答后会从 4 个方面反馈</h3>
              {["是否正面回答问题", "是否说清个人行动", "是否给出真实结果", "是否包含复盘与成长"].map((item) => <p key={item}><Check size={13} />{item}</p>)}
              <div><TriangleAlert size={14} /><span>AI 只会重组你已提供的信息，不会代替你编造经历或数字。</span></div>
            </div>
          )}
        </aside>
      </section>
    </AppShell>
  );
}

function EvaluationReport({ report }: { report: InterviewEvaluation }) {
  const { evaluation } = report;
  return (
    <div className="evaluation-report">
      <div className="evaluation-score"><strong>{Math.round(evaluation.score)}<small>/100</small></strong><div><b>本题表达分</b><span>用于训练，不代表录用概率</span></div></div>
      <ProgressLine value={evaluation.score} />
      <p className="evaluation-summary">{evaluation.summary}</p>
      <section className="evaluation-section positive"><h3>表达亮点</h3>{evaluation.strengths.map((item, index) => <p key={`${item}-${index}`}><Check size={12} />{item}</p>)}</section>
      <section className="evaluation-section improve"><h3>优先改进</h3>{evaluation.improvements.map((item, index) => <p key={`${item}-${index}`}><ArrowRight size={12} />{item}</p>)}</section>
      {evaluation.evidenceFound.length ? <section className="evaluation-evidence"><h3>回答中的证据</h3>{evaluation.evidenceFound.map((item, index) => <q key={`${item}-${index}`}>{item}</q>)}</section> : null}
      <section className="better-answer"><span>参考重组方式</span><p>{evaluation.betterAnswer}</p></section>
      <section className="follow-up"><MessageSquareText size={14} /><p><b>追问题</b><span>{evaluation.followUpQuestion}</span></p></section>
    </div>
  );
}
