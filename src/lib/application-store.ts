import { ApplicationListSchema, type ApplicationRecord } from "@/lib/schemas";
import { readLocalStorageItem, writeLocalStorageItem } from "@/lib/browser-storage";

export const APPLICATION_STORAGE_KEY = "zhihang-applications:v1";
export const APPLICATION_EVENT = "zhihang-applications-change";
const LEGACY_APPLICATION_STORAGE_KEY = "zhihang-applications";

export const DEFAULT_APPLICATIONS: ApplicationRecord[] = [];

export function getApplicationsSnapshot() {
  return readLocalStorageItem(APPLICATION_STORAGE_KEY, LEGACY_APPLICATION_STORAGE_KEY);
}

export function parseApplicationsSnapshot(snapshot: string | null) {
  if (!snapshot) return DEFAULT_APPLICATIONS;
  try {
    const parsed = ApplicationListSchema.safeParse(JSON.parse(snapshot));
    return parsed.success ? parsed.data : DEFAULT_APPLICATIONS;
  } catch {
    return DEFAULT_APPLICATIONS;
  }
}

export function subscribeApplications(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if ([APPLICATION_STORAGE_KEY, LEGACY_APPLICATION_STORAGE_KEY].includes(event.key || "")) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(APPLICATION_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(APPLICATION_EVENT, onStoreChange);
  };
}

export function saveApplications(applications: ApplicationRecord[]) {
  if (!writeLocalStorageItem(APPLICATION_STORAGE_KEY, JSON.stringify(applications))) return false;
  window.dispatchEvent(new Event(APPLICATION_EVENT));
  return true;
}
