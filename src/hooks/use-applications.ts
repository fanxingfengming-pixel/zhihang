"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getApplicationsSnapshot, parseApplicationsSnapshot, subscribeApplications } from "@/lib/application-store";

export function useApplications() {
  const snapshot = useSyncExternalStore(subscribeApplications, getApplicationsSnapshot, () => null);
  return useMemo(() => parseApplicationsSnapshot(snapshot), [snapshot]);
}
