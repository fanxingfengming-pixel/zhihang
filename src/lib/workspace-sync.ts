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
import { readLocalStorageItem, removeLocalStorageItem, writeLocalStorageItem } from "@/lib/browser-storage";

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

const LOCAL_BACKUP_KEY = "zhihang-workspace-before-cloud-restore:v1";

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

function applyWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
  const writes = [
    saveCareerProfile(snapshot.profile),
    saveApplications(snapshot.applications),
    snapshot.careerIntelligence ? saveCareerIntelligence(snapshot.careerIntelligence) : clearCareerIntelligence(),
    saveInterviewHistory(snapshot.interviewHistory),
    saveOfferHistory(snapshot.offerHistory),
  ];
  if (writes.some((saved) => !saved)) throw new Error("浏览器存储空间不足，工作区未能完整恢复。");
}

export function importWorkspaceSnapshot(value: unknown) {
  const snapshot = WorkspaceSnapshotSchema.parse(value);
  const previous = exportWorkspaceSnapshot();
  if (!writeLocalStorageItem(LOCAL_BACKUP_KEY, JSON.stringify(previous))) {
    throw new Error("无法创建本机安全备份，已取消云端恢复。");
  }
  try {
    applyWorkspaceSnapshot(snapshot);
  } catch (error) {
    try {
      applyWorkspaceSnapshot(previous);
    } catch {
      // The untouched backup remains available for an explicit retry.
    }
    throw error;
  }
  return snapshot;
}

export function hasLocalWorkspaceBackup() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(readLocalStorageItem(LOCAL_BACKUP_KEY));
  } catch {
    return false;
  }
}

export function restoreLocalWorkspaceBackup() {
  if (typeof window === "undefined") return false;
  const saved = readLocalStorageItem(LOCAL_BACKUP_KEY);
  if (!saved) return false;
  const backup = WorkspaceSnapshotSchema.parse(JSON.parse(saved));
  applyWorkspaceSnapshot(backup);
  if (!removeLocalStorageItem(LOCAL_BACKUP_KEY)) return false;
  return true;
}
