"use client";

import { ArrowLeft, Check, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { runAgent, type AgentMeta } from "@/lib/agent-client";
import { careerProfileToResumeDraft, DEFAULT_CAREER_PROFILE, loadCareerProfile } from "@/lib/career-profile-store";
import type { ResumeDraft } from "@/lib/resume-draft";
import type { CareerProfile } from "@/lib/schemas";

type ChatMessage = { role: "assistant" | "user"; text: string };
type ResumePreview = { draft: ResumeDraft; profile: CareerProfile; meta: AgentMeta };

const questions = [
  { prompt: "你好，我会用 6 个小问题帮你生成一版简历。先告诉我怎么称呼你？", placeholder: "例如：李明", examples: ["李明", "张晓雨"] },
  { prompt: "你的学校、专业和毕业年份是什么？", placeholder: "例如：浙江大学 · 工业设计 · 2027 届", examples: ["浙江大学 · 工业设计 · 2027 届", "杭州电子科技大学 · 计算机科学 · 2027 届"] },
  { prompt: "你希望投递什么岗位？先写一个最主要的方向。", placeholder: "例如：AI 产品经理", examples: ["AI 产品经理", "产品运营实习生"] },
  { prompt: "你会哪些技能或工具？用逗号隔开即可。", placeholder: "例如：Figma、用户研究、Excel", examples: ["Figma、用户研究、Excel", "Python、SQL、数据分析"] },
  { prompt: "选一个最能代表你的项目，它叫什么？", placeholder: "例如：大学生 AI 求职实训平台", examples: ["大学生 AI 求职实训平台", "校园智能课程助手"] },
  { prompt: "最后说说：你在项目里具体做了什么，产生了什么结果？不需要润色。", placeholder: "例如：访谈18名学生，完成核心流程原型，使测试任务时间减少35%", examples: ["访谈18名学生，完成核心流程原型，使测试任务时间减少35%", "负责需求梳理和原型设计，推动团队完成第一版上线"] },
];

export function ResumeChatBuilder({ onClose, onApply }: { onClose: () => void; onApply: (draft: ResumeDraft, profile: CareerProfile) => void }) {
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [preview, setPreview] = useState<ResumePreview | null>(null);
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: questions[0].prompt }]);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function submitAnswer(event: FormEvent) {
    event.preventDefault();
    const answer = value.trim();
    if (!answer || preview || processing) return;
    const nextAnswers = [...answers, answer];
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text: answer }];
    setValue("");

    if (step === questions.length - 1) {
      setProcessing(true);
      setMessages([...nextMessages, { role: "assistant", text: "信息够了，简历构建 Agent 正在整理 Career Profile…" }]);
      const [name, education, targetRole, skills, projectName, projectResult] = nextAnswers;
      const [school = "", major = "", grade = ""] = education.split(/[·|]/).map((item) => item.trim());
      try {
        const response = await runAgent<CareerProfile>("resume", {
          name, school, major, grade, targetRole, location: "", skills, projectName,
          experience: projectResult,
        }, { currentProfile: loadCareerProfile() || DEFAULT_CAREER_PROFILE });
        const draft = careerProfileToResumeDraft(response.data);
        setAnswers(nextAnswers);
        setPreview({ draft, profile: response.data, meta: response.meta });
        setMessages([...nextMessages, { role: "assistant", text: `Career Profile 已生成。本次由${response.meta.demo ? "演示引擎" : response.meta.provider}完成，你可以预览后应用。` }]);
      } catch (error) {
        setValue(answer);
        setMessages([...nextMessages, { role: "assistant", text: `生成失败：${error instanceof Error ? error.message : "请稍后重试"}` }]);
      } finally {
        setProcessing(false);
      }
      return;
    }

    setAnswers(nextAnswers);
    const nextStep = step + 1;
    setStep(nextStep);
    setMessages([...nextMessages, { role: "assistant", text: questions[nextStep].prompt }]);
  }

  function restart() {
    setStep(0);
    setValue("");
    setAnswers([]);
    setPreview(null);
    setProcessing(false);
    setMessages([{ role: "assistant", text: questions[0].prompt }]);
  }

  const question = questions[step];
  const progress = preview ? 100 : Math.round(((step + 1) / questions.length) * 100);

  return (
    <div className="dialog-backdrop resume-chat-backdrop" role="presentation">
      <section className="resume-chat-dialog" role="dialog" aria-modal="true" aria-labelledby="resume-chat-title">
        <header className="resume-chat-head">
          <div><span><Sparkles size={17} /></span><p><b id="resume-chat-title">对话生成简历</b><small>只整理你提供的事实，不虚构经历</small></p></div>
          <button onClick={onClose} aria-label="关闭对话生成器"><X size={18} /></button>
        </header>
        <div className="chat-progress"><div><span>{preview ? "整理完成" : `第 ${step + 1} 个问题，共 ${questions.length} 个`}</span><b>{progress}%</b></div><i><span style={{ width: `${progress}%` }} /></i></div>

        <div className="builder-body">
          <div className="builder-conversation" aria-live="polite" ref={conversationRef}>
            {messages.map((message, index) => <p key={`${message.role}-${index}`} className={message.role}><span>{message.role === "assistant" ? "AI" : "你"}</span>{message.text}</p>)}
          </div>

          {preview ? (
            <div className="builder-preview">
               <div><span className="preview-avatar">{preview.draft.name.slice(0, 1)}</span><p><b>{preview.draft.name}</b><small>{preview.draft.education}</small></p></div>
               <dl><div><dt>求职方向</dt><dd>{preview.draft.targetRole}</dd></div><div><dt>技能</dt><dd>{preview.draft.skills.join(" / ") || "待补充"}</dd></div><div><dt>项目</dt><dd><b>{preview.draft.projectName}</b>{preview.draft.projectText}</dd></div></dl>
               <button className="primary-button full" onClick={() => onApply(preview.draft, preview.profile)}><Check size={15} />保存 Career Profile 并应用</button>
              <button className="text-button" onClick={restart}><RotateCcw size={13} />重新回答</button>
            </div>
          ) : (
            <form className="builder-input-area" onSubmit={submitAnswer}>
              <div className="quick-replies">{question.examples.map((example) => <button type="button" key={example} onClick={() => setValue(example)}>{example}</button>)}</div>
               <div className="builder-input"><input name="resume-builder-answer" value={value} onChange={(event) => setValue(event.target.value)} aria-label="回答当前问题" autoComplete="off" placeholder={processing ? "Agent 正在整理，请稍候…" : question.placeholder} disabled={processing} autoFocus /><button type="submit" disabled={!value.trim() || processing} aria-label="发送回答"><Send size={16} /></button></div>
               <p><ArrowLeft size={12} />{processing ? "正在调用简历构建 Agent" : "直接说事实即可，后续仍可手动修改"}</p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
