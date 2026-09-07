"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getCareerProfileSnapshot,
  parseCareerProfileSnapshot,
  subscribeCareerProfile,
} from "@/lib/career-profile-store";

export function useCareerProfile() {
  const snapshot = useSyncExternalStore(subscribeCareerProfile, getCareerProfileSnapshot, () => null);
  return useMemo(() => parseCareerProfileSnapshot(snapshot), [snapshot]);
}
