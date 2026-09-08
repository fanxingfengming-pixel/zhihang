"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getCustomJobsSnapshot,
  parseCustomJobsSnapshot,
  subscribeCustomJobs,
} from "@/lib/custom-job-store";

export function useCustomJobs() {
  const snapshot = useSyncExternalStore(subscribeCustomJobs, getCustomJobsSnapshot, () => null);
  return useMemo(() => parseCustomJobsSnapshot(snapshot), [snapshot]);
}
