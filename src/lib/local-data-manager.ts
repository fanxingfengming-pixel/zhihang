import { z } from "zod";
import { AI_DATA_CONSENT_KEY } from "@/lib/ai-data-consent";
import { APPLICATION_STORAGE_KEY } from "@/lib/application-store";
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  removeSessionStorageItem,
  writeLocalStorageItem,
} from "@/lib/browser-storage";
import { CAREER_PROFILE_STORAGE_KEY } from "@/lib/career-profile-store";
import { CUSTOM_JOB_STORAGE_KEY, CustomJobListSchema, loadCustomJobs } from "@/lib/custom-job-store";
import {
  CAREER_INTELLIGENCE_STORAGE_KEY,
  INTERVIEW_HISTORY_STORAGE_KEY,
  OFFER_HISTORY_STORAGE_KEY,
} from "@/lib/insight-history-store";
import { getOfferDraftsSnapshot, OFFER_DRAFT_STORAGE_KEY, OfferDraftListSchema, parseOfferDraftsSnapshot } from "@/lib/offer-draft-store";
import { getSavedJobsSnapshot, SAVED_JOB_STORAGE_KEY, SavedJobListSchema, parseSavedJobsSnapshot } from "@/lib/saved-job-store";
import { exportWorkspaceSnapshot, WorkspaceSnapshotSchema } from "@/lib/workspace-sync";

export const PortableWorkspaceSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  workspace: WorkspaceSnapshotSchema,
  customJobs: CustomJobListSchema,
  offerDrafts: OfferDraftListSchema,
  savedJobIds: SavedJobListSchema,
});

export type PortableWorkspace = z.infer<typeof PortableWorkspaceSchema>;

const LOCAL_KEYS = [
  AI_DATA_CONSENT_KEY,
  APPLICATION_STORAGE_KEY,
  CAREER_PROFILE_STORAGE_KEY,
  CUSTOM_JOB_STORAGE_KEY,
  CAREER_INTELLIGENCE_STORAGE_KEY,
  INTERVIEW_HISTORY_STORAGE_KEY,
  OFFER_HISTORY_STORAGE_KEY,
  OFFER_DRAFT_STORAGE_KEY,
  SAVED_JOB_STORAGE_KEY,
  "zhihang-workspace-before-cloud-restore:v1",
  "zhihang-career-profile",
  "zhihang-applications",
  "zhihang-career-intelligence",
  "zhihang-interview-history",
  "zhihang-offer-history",
] as const;

const LOCAL_OWNER_KEY = "zhihang-local-workspace-owner:v1";

export function exportPortableWorkspace(): PortableWorkspace {
  return PortableWorkspaceSchema.parse({
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: exportWorkspaceSnapshot(),
    customJobs: loadCustomJobs(),
    offerDrafts: parseOfferDraftsSnapshot(getOfferDraftsSnapshot()),
    savedJobIds: parseSavedJobsSnapshot(getSavedJobsSnapshot()),
  });
}

export function clearLocalAppData() {
  if (typeof window === "undefined") return false;
  const localResults = LOCAL_KEYS.map((key) => removeLocalStorageItem(key));
  for (const key of LOCAL_KEYS) window.dispatchEvent(new StorageEvent("storage", { key }));
  const sessionKeys = Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith("zhihang-job-analysis:")));
  const sessionResults = sessionKeys.map((key) => removeSessionStorageItem(key));
  return [...localResults, ...sessionResults].every(Boolean);
}

export function bindLocalWorkspaceToUser(userId: string) {
  if (typeof window === "undefined" || !userId) return { changed: false, cleared: false };
  const previousUserId = readLocalStorageItem(LOCAL_OWNER_KEY);
  const changed = Boolean(previousUserId && previousUserId !== userId);
  const cleared = changed ? clearLocalAppData() : false;
  writeLocalStorageItem(LOCAL_OWNER_KEY, userId);
  return { changed, cleared };
}
