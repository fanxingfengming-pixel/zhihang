"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  getCachedJobAnalysisSnapshot,
  getCachedJobScoresSnapshot,
  parseCachedJobAnalysis,
  subscribeJobAnalysis,
} from "@/lib/job-analysis";

export function useJobAnalysis(jobId: string, profileUpdatedAt: string) {
  const getSnapshot = useCallback(
    () => getCachedJobAnalysisSnapshot(jobId, profileUpdatedAt),
    [jobId, profileUpdatedAt],
  );
  const snapshot = useSyncExternalStore(subscribeJobAnalysis, getSnapshot, () => null);
  return useMemo(
    () => parseCachedJobAnalysis(snapshot, jobId, profileUpdatedAt),
    [jobId, profileUpdatedAt, snapshot],
  );
}

export function useJobAnalysisScores(jobIds: string[], profileUpdatedAt: string) {
  const jobIdsKey = jobIds.join("|");
  const getSnapshot = useCallback(
    () => getCachedJobScoresSnapshot(jobIdsKey ? jobIdsKey.split("|") : [], profileUpdatedAt),
    [jobIdsKey, profileUpdatedAt],
  );
  const snapshot = useSyncExternalStore(subscribeJobAnalysis, getSnapshot, () => "{}");
  return useMemo(() => {
    try {
      return JSON.parse(snapshot) as Record<string, number>;
    } catch {
      return {};
    }
  }, [snapshot]);
}
