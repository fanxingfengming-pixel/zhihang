"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getCareerIntelligenceSnapshot,
  getInterviewHistorySnapshot,
  getOfferHistorySnapshot,
  parseCareerIntelligence,
  parseInterviewHistory,
  parseOfferHistory,
  subscribeInsightHistory,
} from "@/lib/insight-history-store";

export function useCareerIntelligenceHistory() {
  const snapshot = useSyncExternalStore(subscribeInsightHistory, getCareerIntelligenceSnapshot, () => null);
  return useMemo(() => parseCareerIntelligence(snapshot), [snapshot]);
}

export function useInterviewHistory() {
  const snapshot = useSyncExternalStore(subscribeInsightHistory, getInterviewHistorySnapshot, () => null);
  return useMemo(() => parseInterviewHistory(snapshot), [snapshot]);
}

export function useOfferHistory() {
  const snapshot = useSyncExternalStore(subscribeInsightHistory, getOfferHistorySnapshot, () => null);
  return useMemo(() => parseOfferHistory(snapshot), [snapshot]);
}
