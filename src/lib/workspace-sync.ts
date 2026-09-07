import { z } from "zod";
import { ApplicationListSchema } from "@/lib/schemas";
import { CareerProfileSchema } from "@/lib/schemas";
import {
  CareerIntelligenceRecordSchema,
  InterviewPracticeRecordSchema,
  OfferComparisonRecordSchema,
  clearCareerIntelligence,
  getCareerIntelligenceSnapshot,
  getInterviewHistorySnapshot,
  getOfferHistorySnapshot,
  parseCareerIntelligence,
  parseInterviewHistory,
  parseOfferHistory,
  saveCareerIntelligence,
  saveInterviewHistory,
  saveOfferHistory,
} from "@/lib/insight-history-store";
import {
  getApplicationsSnapshot,
  parseApplicationsSnapshot,
  saveApplications,
} from "@/lib/application-store";
import {
  getCareerProfileSnapshot,
  parseCareerProfileSnapshot,
  saveCareerProfile,
} from "@/lib/career-profile-store";

export const WorkspaceSnapshotSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  profile: CareerProfileSchema,
  applications: ApplicationListSchema,
  careerIntelligence: CareerIntelligenceRecordSchema.nullable(),
  interviewHistory: z.array(InterviewPracticeRecordSchema),
  offerHistory: z.array(OfferComparisonRecordSchema),
});

export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;

const LOCAL_BACKUP_KEY = "zhihang-workspace-before-cloud-restore";

export function exportWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: parseCareerProfileSnapshot(getCareerProfileSnapshot()),
    applications: parseApplicationsSnapshot(getApplicationsSnapshot()),
    careerIntelligence: parseCareerIntelligence(getCareerIntelligenceSnapshot()),
    interviewHistory: parseInterviewHistory(getInterviewHistorySnapshot()),
    offerHistory: parseOfferHistory(getOfferHistorySnapshot()),
  };
}

export function importWorkspaceSnapshot(value: unknown) {
  const snapshot = WorkspaceSnapshotSchema.parse(value);
  window.localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(exportWorkspaceSnapshot()));
  saveCareerProfile(snapshot.profile);
  saveApplications(snapshot.applications);
  if (snapshot.careerIntelligence) saveCareerIntelligence(snapshot.careerIntelligence);
  else clearCareerIntelligence();
  saveInterviewHistory(snapshot.interviewHistory);
  saveOfferHistory(snapshot.offerHistory);
  return snapshot;
}
