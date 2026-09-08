import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test("新用户从空白真实状态开始，浏览页面不会自动调用 Agent", async ({ page }) => {
  const agentCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/agents/")) agentCalls.push(request.url());
  });

  await page.goto("/");
  await expect(page.locator(".readiness strong")).toContainText("0%");
  await expect(page.locator("body")).not.toContainText("李同学");
  await expect(page.locator("body")).not.toContainText("浙江大学");

  await page.goto("/jobs");
  await expect(page.getByText("等待开始分析")).toBeVisible();
  await page.goto("/workspace");
  await expect(page.getByRole("button", { name: "先运行岗位分析" })).toBeVisible();
  await page.goto("/interview");
  await expect(page.getByRole("button", { name: "生成面试题" })).toBeVisible();
  expect(agentCalls).toEqual([]);
});

test("真实材料导入到 Offer 比较的核心链路", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/settings");
  const settingsResponse = await page.request.post("/api/settings/ai", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      provider: "qwen",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
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

  await page.getByRole("button", { name: "手动编辑" }).click();
  await page.getByLabel("手动编辑项目经历").fill("我完成学生访谈、需求整理和原型设计，并保留了可核验的项目材料。回归保存标记");
  await page.getByRole("button", { name: "保存修改" }).click();
  await page.reload();
  await expect(page.getByText(/回归保存标记/)).toBeVisible();

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

test("自定义 JD 会在岗位、简历工作区和面试页之间保持接线", async ({ page }) => {
  const settingsResponse = await page.request.post("/api/settings/ai", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      provider: "qwen",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-plus",
      demoMode: true,
    },
  });
  expect(settingsResponse.ok()).toBeTruthy();

  await page.goto("/jobs");
  await page.getByRole("button", { name: /粘贴真实 JD/ }).click();
  await page.getByLabel("JD 原文").fill("公司：星河实验室\n岗位：智能体产品实习生\n岗位职责：完成用户调研、智能体流程设计和原型验证。\n任职要求：熟悉产品设计、Figma、数据分析与沟通协作。");
  await page.getByRole("button", { name: /解析并匹配/ }).click();
  await expect(page.getByText("星河实验室", { exact: true }).first()).toBeVisible();

  const workspaceLink = page.getByRole("link", { name: /针对该岗位优化简历/ });
  const interviewLink = page.getByRole("link", { name: /开始岗位模拟面试/ });
  const workspaceHref = await workspaceLink.getAttribute("href");
  const interviewHref = await interviewLink.getAttribute("href");
  expect(workspaceHref).toMatch(/^\/workspace\?job=custom-/);
  expect(interviewHref).toMatch(/^\/interview\?job=custom-/);

  await page.goto(workspaceHref!);
  await expect(page.locator(".target-job-mini")).toContainText("星河实验室");
  await page.goto(interviewHref!);
  await expect(page.locator(".interview-job-select select")).toHaveValue(interviewHref!.split("job=")[1]);
  await expect(page.locator(".interview-target")).toContainText("星河实验室");
});

test("账号同步入口在未配置和已配置环境下均可安全打开", async ({ page }) => {
  await page.goto("/settings#cloud-sync");
  await expect(page.getByRole("heading", { name: "账号与云同步" })).toBeVisible();
  await expect(page.locator("#cloud-sync .api-state")).toContainText(/未启用|等待登录|检查中|已登录/);

  const response = await page.request.get("/api/sync");
  expect([401, 503]).toContain(response.status());
});

test("真实模型需明确同意，岗位收藏和完整备份可持久化", async ({ page }) => {
  await page.goto("/settings");
  const demoToggle = page.getByRole("checkbox", { name: "使用演示模式" });
  if (await demoToggle.isChecked()) await demoToggle.uncheck();
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect(page.getByRole("status")).toContainText("请先确认");

  await page.getByRole("checkbox", { name: "我已了解并同意必要数据发送" }).check();
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect(page.getByRole("status")).toContainText("API 设置已保存");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载完整备份" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^zhihang-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const backup = JSON.parse(await readFile(downloadPath!, "utf8")) as Record<string, unknown>;
  expect(backup).toMatchObject({ version: 1, customJobs: [], offerDrafts: [], savedJobIds: [] });
  expect(JSON.stringify(backup)).not.toContain("apiKey");

  await page.goto("/jobs");
  await page.getByRole("button", { name: "收藏岗位" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "取消收藏岗位" })).toBeVisible();
});
