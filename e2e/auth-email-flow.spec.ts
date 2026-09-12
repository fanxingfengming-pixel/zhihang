import { expect, test } from "@playwright/test";

test.describe("邮箱确认页面与错误恢复", () => {
  test("注册入口和等待确认页面可用", async ({ page }) => {
    await page.goto("/login?mode=signup&next=%2Fcareer");
    await expect(page.getByRole("heading", { name: "创建职航账号" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "注册" })).toHaveAttribute("aria-selected", "true");

    await page.goto("/verify-email?next=%2Fcareer");
    await expect(page.getByRole("heading", { name: "确认邮件已经发送" })).toBeVisible();
    await expect(page.getByLabel("没有收到？填写注册邮箱后重新发送")).toBeVisible();
    await expect(page.getByRole("button", { name: "重新发送确认邮件" })).toBeVisible();
  });

  test("无效确认链接进入可恢复页面", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=invalid&type=signup&next=%2Fcareer");
    await expect(page).toHaveURL(/\/verify-email\?status=error/);
    await expect(page.getByRole("heading", { name: "重新确认你的邮箱" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("确认链接无效或已经过期");
  });

  test("未建立会话时不能伪造确认成功", async ({ page }) => {
    await page.goto("/auth/confirmed?next=%2Fcareer");
    await expect(page).toHaveURL(/\/verify-email\?status=error/);
  });
});
