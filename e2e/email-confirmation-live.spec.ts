import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const adminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const enabled = process.env.RUN_LIVE_SUPABASE_E2E === "true" && Boolean(supabaseUrl && adminKey);

test.describe("Supabase 真实邮箱确认令牌", () => {
  test.skip(!enabled, "需要显式启用并提供 Supabase 服务端测试密钥");

  test("确认 signup token、建立会话并删除临时用户", async ({ page }) => {
    test.setTimeout(60_000);
    const admin = createClient(supabaseUrl, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const email = `zhihang-confirm-${Date.now()}@example.test`;
    const password = `Test-${crypto.randomUUID()}!`;
    let userId = "";

    try {
      const { data, error } = await admin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
      });
      if (error || !data.properties || !data.user) {
        throw new Error(`无法生成临时确认令牌：${error?.code || "empty_response"}`);
      }
      expect(data.properties.hashed_token).toBeTruthy();
      userId = data.user.id;

      await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=signup&next=%2Fcareer`);
      await expect(page).toHaveURL(/\/auth\/confirmed\?next=/);
      await expect(page.getByRole("heading", { name: "邮箱确认成功" })).toBeVisible();
      await page.getByRole("button", { name: /进入职航/ }).click();
      await expect(page).toHaveURL(/\/career/);
      await expect(page.locator(".sidebar-logout")).toBeVisible();
    } finally {
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  });
});
