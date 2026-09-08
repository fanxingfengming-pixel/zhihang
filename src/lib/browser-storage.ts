export const STORAGE_FAILURE_EVENT = "zhihang-browser-storage-failure";

function notifyStorageFailure() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STORAGE_FAILURE_EVENT));
}

export function readLocalStorageItem(key: string, legacyKey?: string) {
  if (typeof window === "undefined") return null;
  try {
    const current = window.localStorage.getItem(key);
    if (current !== null || !legacyKey) return current;
    const legacy = window.localStorage.getItem(legacyKey);
    if (legacy === null) return null;
    try {
      window.localStorage.setItem(key, legacy);
      window.localStorage.removeItem(legacyKey);
    } catch {
      notifyStorageFailure();
    }
    return legacy;
  } catch {
    return null;
  }
}

export function writeLocalStorageItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    notifyStorageFailure();
    return false;
  }
}

export function removeLocalStorageItem(key: string) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    notifyStorageFailure();
    return false;
  }
}

export function readSessionStorageItem(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSessionStorageItem(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    notifyStorageFailure();
    return false;
  }
}

export function removeSessionStorageItem(key: string) {
  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
