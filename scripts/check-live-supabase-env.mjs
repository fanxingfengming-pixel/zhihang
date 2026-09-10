const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_TEST_USER_A_EMAIL",
  "SUPABASE_TEST_USER_A_PASSWORD",
  "SUPABASE_TEST_USER_B_EMAIL",
  "SUPABASE_TEST_USER_B_PASSWORD",
];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error(`Supabase 线上隔离测试缺少 GitHub Secrets：${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Supabase 线上隔离测试配置完整。测试只会使用两个专用账号。 ");
}
