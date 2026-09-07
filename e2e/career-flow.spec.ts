import { expect, test } from "@playwright/test";

test("真实材料导入到 Offer 比较的核心链路", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/settings");
  const settingsResponse = await page.request.post("/api/settings/ai", {
    data: {
      provider: "qwen",
      baseUrl: "https://example.com/compatible-mode/v1",
      model: "qwen-plus",
      demoMode: true,
    },
  });
  expect(settingsResponse.ok()).toBeTruthy();

  await page.goto("/workspace");
  await page.locator("button.resume-import-launch").click();
  await expect(page.getByRole("dialog", { name: "导入已有简历" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "真实简历.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("李明\n示例大学\n求职方向：AI 产品实习生\n技能：Figma、数据分析\n校园求职助手项目\n完成学生访谈和原型设计", "utf-8"),
  });
  await expect(page.getByText("真实简历.txt")).toBeVisible();
  await page.getByRole("button", { name: /交给简历 Agent 整理/ }).click();
  await expect(page.getByRole("button", { name: /确认并保存档案/ })).toBeVisible();
  await page.getByRole("button", { name: /确认并保存档案/ }).click();
  await expect(page.getByText(/对话内容已整理为结构化简历/)).toBeVisible();

  await page.goto("/jobs");
  await page.getByRole("button", { name: /粘贴真实 JD/ }).click();
  await page.getByLabel("JD 原文").fill("公司：示例科技\n岗位：AI 产品实习生\n岗位职责：参与用户需求分析和产品原型设计。\n任职要求：熟悉 Figma、数据分析和沟通协作。");
  await page.getByRole("button", { name: /解析并匹配/ }).click();
  await expect(page.getByText("示例科技", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "加入投递中心" }).click();
  await expect(page.getByRole("status").filter({ hasText: "已加入投递中心" })).toBeVisible();

  await page.goto("/career");
  await page.getByRole("button", { name: "生成职业报告" }).click();
  await expect(page.getByText("职业定位", { exact: true })).toBeVisible();
  await expect(page.getByText(/4 周证据提升计划/)).toBeVisible();

  await page.goto("/interview");
  await page.getByRole("button", { name: "生成面试题" }).click();
  await page.getByRole("textbox", { name: /输入你的回答/ }).fill("我负责完成学生访谈和原型设计，根据真实反馈重新整理流程并交付了可运行版本。");
  await page.getByRole("button", { name: "提交回答并评分" }).click();
  await expect(page.getByText("本题表达分")).toBeVisible();
  await expect(page.getByText(/只补充能够核实的信息/)).toBeVisible();

  await page.goto("/applications");
  await page.getByRole("button", { name: "AI 整理下一步" }).click();
  await expect(page.getByText("流水线清晰度")).toBeVisible();
  await page.getByRole("button", { name: "载入示例" }).click();
  await page.getByRole("button", { name: "AI 比较 Offer" }).click();
  await expect(page.getByText(/年度现金合计/).first()).toBeVisible();
  await expect(page.getByText("需要核实")).toBeVisible();
});

test("账号同步入口在未配置和已配置环境下均可安全打开", async ({ page }) => {
  await page.goto("/settings#cloud-sync");
  await expect(page.getByRole("heading", { name: "账号与云同步" })).toBeVisible();
  await expect(page.locator("#cloud-sync .api-state")).toContainText(/未启用|等待登录|检查中|已登录/);

  const response = await page.request.get("/api/sync");
  expect([401, 503]).toContain(response.status());
});
