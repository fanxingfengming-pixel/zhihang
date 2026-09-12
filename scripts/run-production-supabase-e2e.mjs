import { spawn } from "node:child_process";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "https://zhihang-fengming.vercel.app";
const playwrightCli = "node_modules/@playwright/test/cli.js";
const args = [
  "--env-file=.env.local",
  playwrightCli,
  "test",
  "e2e/supabase-live.spec.ts",
  "e2e/email-confirmation-live.spec.ts",
];

const child = spawn(process.execPath, args, {
  env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`无法启动生产环境验收：${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`生产环境验收被信号 ${signal} 中止。`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
