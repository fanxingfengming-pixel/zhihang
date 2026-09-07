import { z } from "zod";
import { CareerPositioningSchema, GrowthPlanSchema, InterviewEvaluationSchema, OfferCandidateSchema, OfferDecisionSchema, SkillGapAnalysisSchema } from "@/lib/schemas";

const AgentMetaSchema = z.object({ provider: z.string(), demo: z.boolean() });

export const CareerIntelligenceRecordSchema = z.object({
  profileUpdatedAt: z.string(),
  generatedAt: z.string(),
  positioning: CareerPositioningSchema,
  gap: SkillGapAnalysisSchema,
  plan: GrowthPlanSchema,
  meta: AgentMetaSchema,
});

export const InterviewPracticeRecordSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  jobTitle: z.string(),
  question: z.string(),
  answer: z.string(),
  evaluation: InterviewEvaluationSchema,
  meta: AgentMetaSchema,
  createdAt: z.string(),
});

export const OfferComparisonRecordSchema = z.object({
  id: z.string(),
  offers: z.array(OfferCandidateSchema),
  decision: OfferDecisionSchema,
  meta: AgentMetaSchema,
  createdAt: z.string(),
});

export type CareerIntelligenceRecord = z.infer<typeof CareerIntelligenceRecordSchema>;
export type InterviewPracticeRecord = z.infer<typeof InterviewPracticeRecordSchema>;
export type OfferComparisonRecord = z.infer<typeof OfferComparisonRecordSchema>;

export const CAREER_INTELLIGENCE_STORAGE_KEY = "zhihang-career-intelligence";
export const INTERVIEW_HISTORY_STORAGE_KEY = "zhihang-interview-history";
export const OFFER_HISTORY_STORAGE_KEY = "zhihang-offer-history";
const INSIGHT_EVENT = "zhihang-insight-history-change";

function getItem(key: string) {
  return typeof window === "undefined" ? null : window.localStorage.getItem(key);
}

function parseItem<T>(snapshot: string | null, schema: z.ZodType<T>, fallback: T) {
  if (!snapshot) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(snapshot));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

function saveItem(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(INSIGHT_EVENT));
}

export function subscribeInsightHistory(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if ([CAREER_INTELLIGENCE_STORAGE_KEY, INTERVIEW_HISTORY_STORAGE_KEY, OFFER_HISTORY_STORAGE_KEY].includes(event.key || "")) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(INSIGHT_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(INSIGHT_EVENT, onStoreChange);
  };
}

export const getCareerIntelligenceSnapshot = () => getItem(CAREER_INTELLIGENCE_STORAGE_KEY);
export const getInterviewHistorySnapshot = () => getItem(INTERVIEW_HISTORY_STORAGE_KEY);
export const getOfferHistorySnapshot = () => getItem(OFFER_HISTORY_STORAGE_KEY);

export const parseCareerIntelligence = (snapshot: string | null) => parseItem(snapshot, CareerIntelligenceRecordSchema.nullable(), null);
export const parseInterviewHistory = (snapshot: string | null) => parseItem(snapshot, z.array(InterviewPracticeRecordSchema), []);
export const parseOfferHistory = (snapshot: string | null) => parseItem(snapshot, z.array(OfferComparisonRecordSchema), []);

export const saveCareerIntelligence = (record: CareerIntelligenceRecord) => saveItem(CAREER_INTELLIGENCE_STORAGE_KEY, record);
export const saveInterviewHistory = (records: InterviewPracticeRecord[]) => saveItem(INTERVIEW_HISTORY_STORAGE_KEY, records.slice(0, 50));
export const saveOfferHistory = (records: OfferComparisonRecord[]) => saveItem(OFFER_HISTORY_STORAGE_KEY, records.slice(0, 20));

export function clearCareerIntelligence() {
  window.localStorage.removeItem(CAREER_INTELLIGENCE_STORAGE_KEY);
  window.dispatchEvent(new Event(INSIGHT_EVENT));
}
