import { z } from "zod";
import type { Job } from "@/lib/ui-data";
import { readLocalStorageItem, writeLocalStorageItem } from "@/lib/browser-storage";

export const CUSTOM_JOB_STORAGE_KEY = "zhihang-custom-jobs:v1";
export const CUSTOM_JOB_EVENT = "zhihang-custom-jobs-change";

const JobSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  location: z.string(),
  salary: z.string(),
  match: z.number(),
  initials: z.string(),
  posted: z.string(),
  createdAt: z.string().optional(),
  sourceText: z.string().optional(),
  tags: z.array(z.string()),
  summary: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(z.string()),
  scores: z.array(z.object({ label: z.string(), value: z.number() })),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
});

export const CustomJobListSchema = z.array(JobSchema);

export function getCustomJobsSnapshot() {
  return readLocalStorageItem(CUSTOM_JOB_STORAGE_KEY);
}

export function parseCustomJobsSnapshot(snapshot: string | null): Job[] {
  if (!snapshot) return [];
  try {
    const parsed = CustomJobListSchema.safeParse(JSON.parse(snapshot));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function loadCustomJobs() {
  return parseCustomJobsSnapshot(getCustomJobsSnapshot());
}

export function saveCustomJobs(customJobs: Job[]) {
  const parsed = CustomJobListSchema.parse(customJobs);
  if (!writeLocalStorageItem(CUSTOM_JOB_STORAGE_KEY, JSON.stringify(parsed))) return false;
  window.dispatchEvent(new Event(CUSTOM_JOB_EVENT));
  return true;
}

export function saveCustomJob(job: Job) {
  const current = loadCustomJobs();
  return saveCustomJobs([job, ...current.filter((item) => item.id !== job.id)]);
}

export function removeCustomJob(jobId: string) {
  return saveCustomJobs(loadCustomJobs().filter((item) => item.id !== jobId));
}

export function subscribeCustomJobs(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === CUSTOM_JOB_STORAGE_KEY) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CUSTOM_JOB_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CUSTOM_JOB_EVENT, onStoreChange);
  };
}
