import { Check, Circle, RefreshCw, TriangleAlert } from "lucide-react";

export type AgentTraceStep = {
  id: string;
  label: string;
  description: string;
  source: string;
  status: "waiting" | "running" | "completed" | "error";
};

export function AgentTrace({ title = "Agent 协作轨迹", steps }: { title?: string; steps: AgentTraceStep[] }) {
  return (
    <section className="agent-trace" aria-label={title}>
      <header><span>LIVE ORCHESTRATION</span><b>{title}</b></header>
      <div>{steps.map((step, index) => <article key={step.id} className={step.status}>
        <span className="agent-trace-marker">{step.status === "completed" ? <Check size={11} /> : step.status === "running" ? <RefreshCw size={11} className="spin" /> : step.status === "error" ? <TriangleAlert size={11} /> : <Circle size={9} />}</span>
        <p><small>AGENT {String(index + 1).padStart(2, "0")}</small><b>{step.label}</b><em>{step.description}</em></p>
        <span className="agent-trace-source">读取：{step.source}</span>
      </article>)}</div>
    </section>
  );
}
