import { z } from "zod";

export const ExperienceSchema = z.object({
  title: z.string(),
  organization: z.string(),
  period: z.string(),
  role: z.string(),
  details: z.array(z.string()),
  result: z.string(),
});

export const CareerProfileSchema = z.object({
  basics: z.object({
    name: z.string(),
    school: z.string(),
    major: z.string(),
    grade: z.string(),
    targetRole: z.string(),
    location: z.string(),
    industry: z.string().optional(),
    careerStage: z.string().optional(),
  }),
  skills: z.array(z.string()),
  strengths: z.array(z.string()),
  projects: z.array(ExperienceSchema),
  resumeMarkdown: z.string(),
  updatedAt: z.string(),
});

export const JDAnalysisSchema = z.object({
  jobTitle: z.string(),
  company: z.string(),
  summary: z.string(),
  responsibilities: z.array(z.string()),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  keywords: z.array(z.string()),
  experienceLevel: z.string(),
  education: z.string(),
});

export const MatchReportSchema = z.object({
  score: z.number().min(0).max(100),
  dimensions: z.object({
    skills: z.number().min(0).max(100),
    projects: z.number().min(0).max(100),
    education: z.number().min(0).max(100),
    experience: z.number().min(0).max(100),
  }),
  verdict: z.string(),
  matchedSkills: z.array(z.string()),
  gaps: z.array(z.string()),
  evidence: z.array(z.string()),
  actionPlan: z.array(z.string()),
  resumeTips: z.array(z.string()),
});

export const ResumeOptimizationInputSchema = z.object({
  profile: CareerProfileSchema,
  currentResumeText: z.string().optional(),
  targetSection: z.string().optional(),
});

export const ResumeOptimizationSchema = z.object({
  optimizedProfile: CareerProfileSchema,
  optimizedResumeMarkdown: z.string(),
  headline: z.string(),
  summary: z.string(),
  changes: z.array(z.object({
    section: z.string(),
    before: z.string(),
    after: z.string(),
    reason: z.string(),
    evidence: z.array(z.string()),
  })),
  usedKeywords: z.array(z.string()),
  unresolvedGaps: z.array(z.string()),
  factWarnings: z.array(z.string()),
  safeToApply: z.boolean(),
});

export const InterviewQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  intent: z.string(),
  answerFramework: z.array(z.string()),
  keyPoints: z.array(z.string()),
});

export const InterviewPreparationSchema = z.object({
  action: z.literal("prepare"),
  sessionTitle: z.string(),
  openingMessage: z.string(),
  focusAreas: z.array(z.string()),
  questions: z.array(InterviewQuestionSchema).min(1),
});

export const InterviewEvaluationSchema = z.object({
  action: z.literal("evaluate"),
  evaluation: z.object({
    score: z.number().min(0).max(100),
    summary: z.string(),
    strengths: z.array(z.string()),
    improvements: z.array(z.string()),
    evidenceFound: z.array(z.string()),
    betterAnswer: z.string(),
    followUpQuestion: z.string(),
  }),
});

export const InterviewAgentSchema = z.discriminatedUnion("action", [
  InterviewPreparationSchema,
  InterviewEvaluationSchema,
]);

export const CareerPositioningSchema = z.object({
  summary: z.string(),
  recommendedRoles: z.array(z.object({
    role: z.string(),
    fitScore: z.number().min(0).max(100),
    fitReason: z.string(),
    evidence: z.array(z.string()),
    risks: z.array(z.string()),
    nextExperiment: z.string(),
  })).min(1),
  recommendedIndustries: z.array(z.string()),
  positioningStatement: z.string(),
  questionsToConfirm: z.array(z.string()),
});

export const SkillGapAnalysisSchema = z.object({
  readinessScore: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.object({
    skill: z.string(),
    evidence: z.array(z.string()),
  })),
  gaps: z.array(z.object({
    skill: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    reason: z.string(),
    currentEvidence: z.array(z.string()),
    nextProof: z.string(),
  })),
  priorityOrder: z.array(z.string()),
});

export const GrowthPlanSchema = z.object({
  title: z.string(),
  durationWeeks: z.number().int().min(1).max(12),
  objective: z.string(),
  weeklyPlan: z.array(z.object({
    week: z.number().int().min(1),
    focus: z.string(),
    tasks: z.array(z.string()),
    deliverable: z.string(),
    successCheck: z.string(),
  })).min(1),
  maintenanceRules: z.array(z.string()),
});

export const ApplicationStageSchema = z.enum(["interested", "preparing", "applied", "interview", "offer", "closed"]);

export const ApplicationRecordSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  jobId: z.string(),
  stage: ApplicationStageSchema,
  nextAction: z.string(),
  deadline: z.string(),
  notes: z.string(),
  updatedAt: z.string(),
});

export const ApplicationListSchema = z.array(ApplicationRecordSchema);

export const ApplicationManagementSchema = z.object({
  summary: z.string(),
  pipelineHealth: z.number().min(0).max(100),
  priorities: z.array(z.object({
    applicationId: z.string(),
    action: z.string(),
    reason: z.string(),
    urgency: z.enum(["today", "this_week", "later"]),
  })),
  followUps: z.array(z.string()),
  risks: z.array(z.string()),
});

export const OfferCandidateSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  location: z.string(),
  monthlySalary: z.number().min(0),
  salaryMonths: z.number().min(0),
  bonus: z.number().min(0),
  growth: z.string(),
  workLife: z.string(),
  notes: z.string(),
});

export const OfferDecisionSchema = z.object({
  ranking: z.array(z.object({
    offerId: z.string(),
    score: z.number().min(0).max(100),
    reasons: z.array(z.string()),
    risks: z.array(z.string()),
  })),
  recommendation: z.string(),
  tradeoffs: z.array(z.string()),
  questionsToVerify: z.array(z.string()),
  negotiationPoints: z.array(z.string()),
  disclaimer: z.string(),
});

export const AgentRequestSchema = z.object({
  provider: z.enum(["deepseek", "qwen"]).optional(),
  input: z.unknown(),
  context: z.unknown().optional(),
});

export type Experience = z.infer<typeof ExperienceSchema>;
export type CareerProfile = z.infer<typeof CareerProfileSchema>;
export type JDAnalysis = z.infer<typeof JDAnalysisSchema>;
export type MatchReport = z.infer<typeof MatchReportSchema>;
export type ResumeOptimization = z.infer<typeof ResumeOptimizationSchema>;
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;
export type InterviewPreparation = z.infer<typeof InterviewPreparationSchema>;
export type InterviewEvaluation = z.infer<typeof InterviewEvaluationSchema>;
export type InterviewAgentResult = z.infer<typeof InterviewAgentSchema>;
export type CareerPositioning = z.infer<typeof CareerPositioningSchema>;
export type SkillGapAnalysis = z.infer<typeof SkillGapAnalysisSchema>;
export type GrowthPlan = z.infer<typeof GrowthPlanSchema>;
export type ApplicationStage = z.infer<typeof ApplicationStageSchema>;
export type ApplicationRecord = z.infer<typeof ApplicationRecordSchema>;
export type ApplicationManagement = z.infer<typeof ApplicationManagementSchema>;
export type OfferCandidate = z.infer<typeof OfferCandidateSchema>;
export type OfferDecision = z.infer<typeof OfferDecisionSchema>;
export type AgentName = "resume" | "jd" | "match" | "optimize" | "interview" | "career" | "gap" | "plan" | "application" | "offer";

export const EMPTY_PROFILE: CareerProfile = {
  basics: { name: "", school: "", major: "", grade: "", targetRole: "", location: "", industry: "", careerStage: "" },
  skills: [],
  strengths: [],
  projects: [],
  resumeMarkdown: "",
  updatedAt: "",
};
