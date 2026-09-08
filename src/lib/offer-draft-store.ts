import { z } from "zod";
import { OfferCandidateSchema, type OfferCandidate } from "@/lib/schemas";
import { readLocalStorageItem, writeLocalStorageItem } from "@/lib/browser-storage";

export const OFFER_DRAFT_STORAGE_KEY = "zhihang-offer-drafts:v1";
export const OFFER_DRAFT_EVENT = "zhihang-offer-drafts-change";
const OfferDraftListSchema = z.array(OfferCandidateSchema).max(10);

export function getOfferDraftsSnapshot() {
  return readLocalStorageItem(OFFER_DRAFT_STORAGE_KEY);
}

export function parseOfferDraftsSnapshot(snapshot: string | null): OfferCandidate[] {
  if (!snapshot) return [];
  try {
    const parsed = OfferDraftListSchema.safeParse(JSON.parse(snapshot));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function saveOfferDrafts(offers: OfferCandidate[]) {
  const parsed = OfferDraftListSchema.parse(offers);
  if (!writeLocalStorageItem(OFFER_DRAFT_STORAGE_KEY, JSON.stringify(parsed))) return false;
  window.dispatchEvent(new Event(OFFER_DRAFT_EVENT));
  return true;
}

export function subscribeOfferDrafts(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === OFFER_DRAFT_STORAGE_KEY) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(OFFER_DRAFT_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(OFFER_DRAFT_EVENT, onStoreChange);
  };
}
