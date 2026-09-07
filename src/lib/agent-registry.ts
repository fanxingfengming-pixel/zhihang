import { z } from "zod";
import {
  ApplicationManagementSchema,
  CareerPositioningSchema,
  CareerProfileSchema,
  GrowthPlanSchema,
  InterviewAgentSchema,
  JDAnalysisSchema,
  MatchReportSchema,
  OfferDecisionSchema,
  ResumeOptimizationSchema,
  SkillGapAnalysisSchema,
  type AgentName,
} from "@/lib/schemas";

export const AGENT_NAMES = [
  "resume",
  "jd",
  "match",
  "optimize",
  "interview",
  "career",
  "gap",
  "plan",
  "application",
  "offer",
] as const satisfies readonly AgentName[];

export const AGENT_OUTPUT_SCHEMAS: Record<AgentName, z.ZodType> = {
  resume: CareerProfileSchema,
  jd: JDAnalysisSchema,
  match: MatchReportSchema,
  optimize: ResumeOptimizationSchema,
  interview: InterviewAgentSchema,
  career: CareerPositioningSchema,
  gap: SkillGapAnalysisSchema,
  plan: GrowthPlanSchema,
  application: ApplicationManagementSchema,
  offer: OfferDecisionSchema,
};

export function isAgentName(value: string): value is AgentName {
  return (AGENT_NAMES as readonly string[]).includes(value);
}
