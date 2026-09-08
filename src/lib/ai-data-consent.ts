import { readLocalStorageItem, removeLocalStorageItem, writeLocalStorageItem } from "@/lib/browser-storage";

export const AI_DATA_CONSENT_KEY = "zhihang-ai-data-consent:v1";
export const AI_DATA_CONSENT_EVENT = "zhihang-ai-data-consent-change";

type ConsentRecord = {
  accepted: true;
  acceptedAt: string;
  version: 1;
};

export function getAIDataConsentSnapshot() {
  return readLocalStorageItem(AI_DATA_CONSENT_KEY);
}

export function parseAIDataConsent(snapshot: string | null) {
  if (!snapshot) return false;
  try {
    const value = JSON.parse(snapshot) as Partial<ConsentRecord>;
    return value.accepted === true && value.version === 1 && typeof value.acceptedAt === "string";
  } catch {
    return false;
  }
}

export function hasAIDataConsent() {
  return parseAIDataConsent(getAIDataConsentSnapshot());
}

export function saveAIDataConsent(accepted: boolean) {
  const saved = accepted
    ? writeLocalStorageItem(AI_DATA_CONSENT_KEY, JSON.stringify({ accepted: true, acceptedAt: new Date().toISOString(), version: 1 } satisfies ConsentRecord))
    : removeLocalStorageItem(AI_DATA_CONSENT_KEY);
  if (saved) window.dispatchEvent(new Event(AI_DATA_CONSENT_EVENT));
  return saved;
}

export function subscribeAIDataConsent(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === AI_DATA_CONSENT_KEY) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(AI_DATA_CONSENT_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(AI_DATA_CONSENT_EVENT, onStoreChange);
  };
}
