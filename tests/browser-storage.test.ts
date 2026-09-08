import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readLocalStorageItem,
  STORAGE_FAILURE_EVENT,
  writeLocalStorageItem,
} from "@/lib/browser-storage";

type StorageDouble = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function installWindow(localStorage: StorageDouble) {
  const events = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
      dispatchEvent: events.dispatchEvent.bind(events),
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    },
  });
  return events;
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("browser storage", () => {
  it("reads a legacy value even when migrating it is blocked", () => {
    installWindow({
      getItem: vi.fn((key: string) => key === "legacy" ? "saved-value" : null),
      setItem: vi.fn(() => { throw new Error("quota"); }),
      removeItem: vi.fn(),
    });

    expect(readLocalStorageItem("current:v1", "legacy")).toBe("saved-value");
  });

  it("reports a failed write without claiming persistence succeeded", () => {
    const events = installWindow({
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => { throw new Error("blocked"); }),
      removeItem: vi.fn(),
    });
    const failure = vi.fn();
    events.addEventListener(STORAGE_FAILURE_EVENT, failure);

    expect(writeLocalStorageItem("key", "value")).toBe(false);
    expect(failure).toHaveBeenCalledOnce();
  });
});
