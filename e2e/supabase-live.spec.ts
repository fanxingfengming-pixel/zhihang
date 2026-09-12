import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_APPLICATIONS } from "../src/lib/application-store";
import { DEFAULT_CAREER_PROFILE } from "../src/lib/career-profile-store";

const credentials = {
  userA: {
    email: process.env.SUPABASE_TEST_USER_A_EMAIL || "",
    password: process.env.SUPABASE_TEST_USER_A_PASSWORD || "",
  },
  userB: {
    email: process.env.SUPABASE_TEST_USER_B_EMAIL || "",
    password: process.env.SUPABASE_TEST_USER_B_PASSWORD || "",
  },
};
const enabled = process.env.RUN_LIVE_SUPABASE_E2E === "true"
  && Object.values(credentials).every(({ email, password }) => email && password);

type SyncPayload = {
  data: Record<string, unknown> | null;
  updatedAt: string | null;
  error?: string;
};

type BrowserApiResponse<T> = {
  ok: boolean;
  status: number;
  data: T;
};

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/settings#cloud-sync");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "进入职航" }).click();
  await expect(page).toHaveURL(/\/settings/, { timeout: 20_000 });
  await expect(page.locator(".sidebar-logout")).toBeVisible({ timeout: 10_000 });
}

async function callApi<T>(
  page: Page,
  path: string,
  method: "GET" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<BrowserApiResponse<T>> {
  return page.evaluate(async ({ endpoint, requestMethod, requestBody }) => {
    const response = await fetch(endpoint, {
      method: requestMethod,
      headers: requestBody === undefined ? undefined : { "Content-Type": "application/json" },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
    });
    return {
      ok: response.ok,
      status: response.status,
      data: await response.json() as T,
    };
  }, { endpoint: path, requestMethod: method, requestBody: body });
}

async function readCloud(page: Page) {
  const response = await callApi<SyncPayload>(page, "/api/sync");
  expect(response.ok).toBeTruthy();
  return response.data;
}

function emptySnapshot(marker: string) {
  return {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    profile: {
      ...structuredClone(DEFAULT_CAREER_PROFILE),
      basics: { ...DEFAULT_CAREER_PROFILE.basics, name: marker },
    },
    applications: structuredClone(DEFAULT_APPLICATIONS),
    careerIntelligence: null,
    interviewHistory: [],
    offerHistory: [],
  };
}

test.describe("Supabase 真实账号、同步与 RLS", () => {
  test.skip(!enabled, "需要显式启用并提供两个已确认邮箱的专用测试账号");

  test("登录、跨设备恢复、冲突保护、删除与双用户隔离", async ({ browser }) => {
    test.setTimeout(120_000);
    const contextA = await browser.newContext();
    const contextA2 = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageA2 = await contextA2.newPage();
    const pageB = await contextB.newPage();
    const marker = `supabase-e2e-${Date.now()}`;
    let originalA: SyncPayload | null = null;

    try {
      await signIn(pageA, credentials.userA.email, credentials.userA.password);
      originalA = await readCloud(pageA);

      const source = originalA.data
        ? structuredClone(originalA.data)
        : emptySnapshot(marker);
      const snapshot = {
        ...source,
        exportedAt: new Date().toISOString(),
        profile: {
          ...(source.profile as Record<string, unknown>),
          basics: {
            ...((source.profile as { basics: Record<string, unknown> }).basics),
            name: marker,
          },
        },
      };
      const writeA = await callApi<{ updatedAt: string }>(pageA, "/api/sync", "PUT", {
        snapshot,
        expectedUpdatedAt: originalA.updatedAt,
      });
      expect(writeA.ok).toBeTruthy();
      const writtenA = writeA.data;

      await signIn(pageA2, credentials.userA.email, credentials.userA.password);
      const restoredOnSecondDevice = await readCloud(pageA2);
      expect(JSON.stringify(restoredOnSecondDevice.data)).toContain(marker);

      await signIn(pageB, credentials.userB.email, credentials.userB.password);
      const isolatedB = await readCloud(pageB);
      expect(JSON.stringify(isolatedB.data)).not.toContain(marker);

      const newerSnapshot = { ...snapshot, exportedAt: new Date(Date.now() + 1_000).toISOString() };
      const updateA = await callApi(pageA, "/api/sync", "PUT", {
        snapshot: newerSnapshot,
        expectedUpdatedAt: writtenA.updatedAt,
      });
      expect(updateA.ok).toBeTruthy();

      const staleWrite = await callApi(pageA2, "/api/sync", "PUT", {
        snapshot,
        expectedUpdatedAt: writtenA.updatedAt,
      });
      expect(staleWrite.status).toBe(409);
    } finally {
      if (originalA) {
        const current = await readCloud(pageA).catch(() => null);
        if (originalA.data && current?.updatedAt) {
          await callApi(pageA, "/api/sync", "PUT", {
            snapshot: originalA.data,
            expectedUpdatedAt: current.updatedAt,
          });
        } else if (!originalA.data) {
          await callApi(pageA, "/api/sync", "DELETE");
        }
      }
      await Promise.all([contextA.close(), contextA2.close(), contextB.close()]);
    }
  });
});
