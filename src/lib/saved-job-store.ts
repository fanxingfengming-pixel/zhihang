import { z } from "zod";
import { readLocalStorageItem, writeLocalStorageItem } from "@/lib/browser-storage";

export const SAVED_JOB_STORAGE_KEY = "zhihang-saved-jobs:v1";
export const SAVED_JOB_EVENT = "zhihang-saved-jobs-change";
export const SavedJobListSchema = z.array(z.string().min(1)).max(500);

export function getSavedJobsSnapshot() {
  return readLocalStorageItem(SAVED_JOB_STORAGE_KEY);
}

export function parseSavedJobsSnapshot(snapshot: string | null) {
  if (!snapshot) return [];
  try {
    const parsed = SavedJobListSchema.safeParse(JSON.parse(snapshot));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function saveSavedJobs(jobIds: string[]) {
  const value = SavedJobListSchema.parse([...new Set(jobIds)]);
  if (!writeLocalStorageItem(SAVED_JOB_STORAGE_KEY, JSON.stringify(value))) return false;
  window.dispatchEvent(new Event(SAVED_JOB_EVENT));
  return true;
}

export function subscribeSavedJobs(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === SAVED_JOB_STORAGE_KEY) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(SAVED_JOB_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(SAVED_JOB_EVENT, onStoreChange);
  };
}
