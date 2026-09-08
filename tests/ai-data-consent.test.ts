import { afterEach, describe, expect, it, vi } from "vitest";
import { hasAIDataConsent, saveAIDataConsent } from "@/lib/ai-data-consent";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function installWindow() {
  const values = new Map<string, string>();
  const events = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
      dispatchEvent: events.dispatchEvent.bind(events),
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("AI data consent", () => {
  it("requires an explicit stored choice and supports withdrawal", () => {
    installWindow();
    expect(hasAIDataConsent()).toBe(false);
    expect(saveAIDataConsent(true)).toBe(true);
    expect(hasAIDataConsent()).toBe(true);
    expect(saveAIDataConsent(false)).toBe(true);
    expect(hasAIDataConsent()).toBe(false);
  });
});
