# 职航部署说明

当前应用支持两种运行方式：

- **本地演示模式**：不配置 Supabase，Career Profile 与训练历史保存在当前浏览器。
- **账号同步模式**：配置 Supabase Auth + PostgreSQL，每个登录用户拥有一份受 RLS 隔离的工作区快照。

## 1. 创建 Supabase 项目

1. 在 Supabase 新建项目。
2. 打开项目的 Connect 对话框，复制 Project URL 与 Publishable Key。
3. 在 Supabase SQL Editor 中按文件名顺序执行 `supabase/migrations/` 中的全部 SQL；也可以安装 Supabase CLI 后运行 `supabase db push`。
4. 在 Authentication 的 URL Configuration 中加入本地地址 `http://localhost:3000` 和最终 Vercel 域名。

迁移已显式配置 Data API 所需的表权限、RLS 和逐操作策略，可兼容 Supabase 2026 年起“新表默认不自动暴露”的安全默认值。

本地 `.env.local` 增加：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的公开密钥
```

浏览器只使用 Publishable Key 与用户会话。账号删除接口优先使用当前推荐的 `SUPABASE_SECRET_KEY`（`sb_secret_...`）；旧项目可暂时使用 `SUPABASE_SERVICE_ROLE_KEY`。它只能放入未提交的 `.env.local` 或 Vercel 服务端环境变量，**绝不能提交到 Git、写入前端代码或添加 `NEXT_PUBLIC_` 前缀**。

`20260909123919_job_postings_cache.sql` 会创建仅服务端可访问的公开岗位缓存表。实时岗位在未配置 Secret Key 时仍可工作，但只使用当前 Next.js 进程的短期缓存；生产环境建议配置 Secret Key，避免冷启动时重复请求上游。

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

测试文件位于 `supabase/tests/`，覆盖匿名拒绝、用户隔离、所有者增删改查、JSON 数据库约束和共享模型配额；Vitest 还会检查岗位缓存表的 RLS、权限与索引约束。

打开 `http://localhost:3000/settings#cloud-sync`，注册账号，然后测试“上传本机数据”和“从云端恢复”。若 Supabase 开启了邮箱确认，需要先点击验证邮件。

如需自动验证登录、跨设备恢复、乐观锁冲突、删除和双用户 RLS 隔离，请在 Supabase 中准备两个已完成邮箱确认的专用测试账号，在本机环境中填写 `SUPABASE_TEST_USER_A_*` 与 `SUPABASE_TEST_USER_B_*`，然后运行：

在 `.env.local` 中将 `RUN_LIVE_SUPABASE_E2E=true`，然后执行 `pnpm test:supabase:live`。该脚本只读取本机 `.env.local`，不会把测试密码写入仓库。

测试会临时修改 A 账号的工作区并在结束时恢复原始数据；不要使用真实用户账号或生产数据执行。

## 3. 部署到 Vercel

推荐先将当前仓库推送到 GitHub，再在 Vercel 导入仓库：

1. Framework Preset 选择 Next.js。
2. 在 Project Settings → Environment Variables 添加 `.env.example` 中需要的变量。
3. DeepSeek/Qwen 密钥只能放在服务端变量中，不要添加 `NEXT_PUBLIC_` 前缀。
4. Supabase URL 与 Publishable Key 需要同时配置；不配置时线上仍以本地浏览器模式运行。
5. 部署后将正式域名添加到 Supabase Authentication 的 Site URL / Redirect URLs。
6. 如需启用“永久删除账号”，只在 Vercel 服务端环境变量中配置 `SUPABASE_SECRET_KEY`，绝不能暴露为 `NEXT_PUBLIC_` 变量。
7. 设置随机 `CRON_SECRET`。仓库的 `vercel.json` 每天调用一次 `/api/cron/jobs`，Vercel 会用该值生成 Bearer 授权头；普通页面访问则按 `LIVE_JOBS_CACHE_MINUTES` 在缓存过期后按需刷新。
8. 按 `.env.example` 配置要跟踪的 `GREENHOUSE_BOARDS`、`LEVER_SITES` 和 `ASHBY_BOARDS`。Adzuna 凭据为可选项。

邮箱确认与密码恢复使用 SSR/PKCE 回调。请在 Supabase Authentication 中：

- 将 Site URL 设为正式站点域名。
- 将 `http://localhost:3000/auth/confirm`、`http://localhost:3000/auth/update-password` 以及对应正式域名加入 Redirect URLs。
- 默认邮件模板会跟随代码传入的回调地址，无需修改即可完成注册确认和密码恢复。若需要自定义品牌模板，应先配置自定义 SMTP。
- 正式开放注册前配置自定义 SMTP 与 CAPTCHA；Supabase 默认邮件服务只适合开发测试。

每次提交或拉取请求都会运行 `.github/workflows/quality.yml`，检查类型、Lint、Agent 合约测试、生产构建和浏览器主流程。Supabase 变更还会运行 pgTAP 数据库测试；CodeQL 与 Dependabot 负责持续代码和依赖安全检查。

## 尚需账号所有者完成的外部步骤

Codex 无法在没有账号授权的情况下创建 Supabase/Vercel 项目、设置生产密钥或确认邮件域名。仓库内代码和迁移已准备好；外部资源建立后，按上述步骤填入配置即可。
