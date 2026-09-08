"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getOfferDraftsSnapshot, parseOfferDraftsSnapshot, subscribeOfferDrafts } from "@/lib/offer-draft-store";

export function useOfferDrafts() {
  const snapshot = useSyncExternalStore(subscribeOfferDrafts, getOfferDraftsSnapshot, () => null);
  return useMemo(() => parseOfferDraftsSnapshot(snapshot), [snapshot]);
}
