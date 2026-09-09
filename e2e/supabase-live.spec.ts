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

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/settings#cloud-sync");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("status")).toContainText("登录成功");
}

async function readCloud(page: Page) {
  const response = await page.request.get("/api/sync");
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<SyncPayload>;
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
      const writeA = await pageA.request.put("/api/sync", {
        data: { snapshot, expectedUpdatedAt: originalA.updatedAt },
      });
      expect(writeA.ok()).toBeTruthy();
      const writtenA = await writeA.json() as { updatedAt: string };

      await signIn(pageA2, credentials.userA.email, credentials.userA.password);
      const restoredOnSecondDevice = await readCloud(pageA2);
      expect(JSON.stringify(restoredOnSecondDevice.data)).toContain(marker);

      await signIn(pageB, credentials.userB.email, credentials.userB.password);
      const isolatedB = await readCloud(pageB);
      expect(JSON.stringify(isolatedB.data)).not.toContain(marker);

      const newerSnapshot = { ...snapshot, exportedAt: new Date(Date.now() + 1_000).toISOString() };
      const updateA = await pageA.request.put("/api/sync", {
        data: { snapshot: newerSnapshot, expectedUpdatedAt: writtenA.updatedAt },
      });
      expect(updateA.ok()).toBeTruthy();

      const staleWrite = await pageA2.request.put("/api/sync", {
        data: { snapshot, expectedUpdatedAt: writtenA.updatedAt },
      });
      expect(staleWrite.status()).toBe(409);
    } finally {
      if (originalA) {
        const current = await readCloud(pageA).catch(() => null);
        if (originalA.data && current?.updatedAt) {
          await pageA.request.put("/api/sync", {
            data: { snapshot: originalA.data, expectedUpdatedAt: current.updatedAt },
          });
        } else if (!originalA.data) {
          await pageA.request.delete("/api/sync");
        }
      }
      await Promise.all([contextA.close(), contextA2.close(), contextB.close()]);
    }
  });
});
