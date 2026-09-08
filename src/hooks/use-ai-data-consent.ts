"use client";

import { useSyncExternalStore } from "react";
import { getAIDataConsentSnapshot, parseAIDataConsent, subscribeAIDataConsent } from "@/lib/ai-data-consent";

export function useAIDataConsent() {
  const snapshot = useSyncExternalStore(subscribeAIDataConsent, getAIDataConsentSnapshot, () => null);
  return parseAIDataConsent(snapshot);
}
