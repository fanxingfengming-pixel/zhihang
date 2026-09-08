"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getSavedJobsSnapshot, parseSavedJobsSnapshot, subscribeSavedJobs } from "@/lib/saved-job-store";

export function useSavedJobs() {
  const snapshot = useSyncExternalStore(subscribeSavedJobs, getSavedJobsSnapshot, () => null);
  return useMemo(() => parseSavedJobsSnapshot(snapshot), [snapshot]);
}
