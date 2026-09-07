# 职航部署说明

当前应用支持两种运行方式：

- **本地演示模式**：不配置 Supabase，Career Profile 与训练历史保存在当前浏览器。
- **账号同步模式**：配置 Supabase Auth + PostgreSQL，每个登录用户拥有一份受 RLS 隔离的工作区快照。

## 1. 创建 Supabase 项目

1. 在 Supabase 新建项目。
2. 打开项目的 Connect 对话框，复制 Project URL 与 Publishable Key。
3. 在 Supabase SQL Editor 中执行 `supabase/migrations/202609070001_initial_workspace.sql`；也可以安装 Supabase CLI 后执行迁移。
4. 在 Authentication 的 URL Configuration 中加入本地地址 `http://localhost:3000` 和最终 Vercel 域名。

迁移已显式配置 Data API 所需的表权限、RLS 和逐操作策略，可兼容 Supabase 2026 年起“新表默认不自动暴露”的安全默认值。

本地 `.env.local` 增加：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的公开密钥
```

这里只使用 Publishable Key 与用户会话，**不要**把 `service_role` 密钥放入本项目或任何 `NEXT_PUBLIC_` 变量。

## 2. 本地验证

```powershell
Set-Location "D:\CodexProjects\明途科技"
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev
```

如已安装 Supabase CLI 与 Docker，还应在本地数据库运行策略测试：

```powershell
supabase start
supabase test db
```

测试文件位于 `supabase/tests/user_workspaces_rls.test.sql`，覆盖匿名拒绝、用户隔离、所有者增删改查和 JSON 数据库约束。

打开 `http://localhost:3000/settings#cloud-sync`，注册账号，然后测试“上传本机数据”和“从云端恢复”。若 Supabase 开启了邮箱确认，需要先点击验证邮件。

## 3. 部署到 Vercel

推荐先将当前仓库推送到 GitHub，再在 Vercel 导入仓库：

1. Framework Preset 选择 Next.js。
2. 在 Project Settings → Environment Variables 添加 `.env.example` 中需要的变量。
3. DeepSeek/Qwen 密钥只能放在服务端变量中，不要添加 `NEXT_PUBLIC_` 前缀。
4. Supabase URL 与 Publishable Key 需要同时配置；不配置时线上仍以本地浏览器模式运行。
5. 部署后将正式域名添加到 Supabase Authentication 的 Site URL / Redirect URLs。

每次提交或拉取请求都会运行 `.github/workflows/quality.yml`，检查类型、Lint、Agent 合约测试和生产构建。

## 尚需账号所有者完成的外部步骤

Codex 无法在没有账号授权的情况下创建 Supabase/Vercel 项目、设置生产密钥或确认邮件域名。仓库内代码和迁移已准备好；外部资源建立后，按上述步骤填入配置即可。
