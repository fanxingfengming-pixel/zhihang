# 职航部署说明

当前应用支持两种运行方式：

- **本地演示模式**：不配置 Supabase，Career Profile 与训练历史保存在当前浏览器。
- **账号同步模式**：配置 Supabase Auth + PostgreSQL，每个登录用户拥有一份受 RLS 隔离的工作区快照。

## 1. 创建 Supabase 项目

1. 在 Supabase 新建项目。
2. 打开项目的 Connect 对话框，复制 Project URL 与 Publishable Key。
3. 在 Supabase SQL Editor 中按文件名顺序执行 `supabase/migrations/` 中的全部 SQL；也可以安装 Supabase CLI 后运行 `supabase db push`。其中 `20260909150729_ai_usage_observability.sql` 增加 Token/并发/IP 摘要额度、私有用量事件和健康检查汇总，必须在公开共享模型密钥前应用。
4. 在 Authentication 的 URL Configuration 中加入本地地址 `http://localhost:3000` 和最终 Vercel 域名。

迁移已显式配置 Data API 所需的表权限、RLS 和逐操作策略，可兼容 Supabase 2026 年起“新表默认不自动暴露”的安全默认值。

本地 `.env.local` 增加：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的公开密钥
NEXT_PUBLIC_SITE_URL=https://你的生产域名
SUPABASE_SECRET_KEY=你的服务端SecretKey
```

浏览器只使用 Publishable Key 与用户会话。账号删除接口优先使用当前推荐的 `SUPABASE_SECRET_KEY`（`sb_secret_...`）；旧项目可暂时使用 `SUPABASE_SERVICE_ROLE_KEY`。它只能放入未提交的 `.env.local` 或 Vercel 服务端环境变量，**绝不能提交到 Git、写入前端代码或添加 `NEXT_PUBLIC_` 前缀**。

### 邮箱确认与密码重置

在 Supabase Authentication → URL Configuration 中设置：

- Site URL：`https://zhihang-fengming.vercel.app`
- Redirect URLs：`https://zhihang-fengming.vercel.app/auth/confirm`
- 本地调试可额外保留：`http://localhost:3000/auth/confirm`

Authentication → Providers → Email 中必须启用 Confirm email。注册后应用会进入 `/verify-email`，支持重新发送确认邮件；确认成功进入 `/auth/confirmed`，密码重置则进入 `/auth/update-password`。生产环境应配置自有 SMTP，避免 Supabase 默认邮件服务的收件人限制、速率限制和模板限制。

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

GitHub Actions 还提供手动工作流 `Supabase Live Verification`。在仓库 Secrets 中配置 Supabase URL、Publishable Key 和两个专用测试账号后，可从 Actions 页面手动运行；缺少任一 Secret 时工作流会直接说明缺项，不会误报通过。

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

生产环境还必须配置：

- `RATE_LIMIT_HASH_SECRET`：至少 32 个字符，用于把 IP/客户端标识转换为 HMAC 摘要；数据库不保存原始 IP。
- `HEALTHCHECK_SECRET`：至少 32 个字符，用于受保护的深度健康检查。
- 当前默认模型的 `*_INPUT_COST_CNY_PER_M_TOKENS` 与 `*_OUTPUT_COST_CNY_PER_M_TOKENS`：请按模型控制台当前价格填写，不在代码中写死易过期的价格。
- `AI_ALERT_WEBHOOK_URL`：HTTPS 告警接收地址，只接收预算阈值和故障元数据，不包含用户求职资料。
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`：Cloudflare Turnstile 的公开 Site Key；对应 Secret Key 只填写在 Supabase Authentication → Bot and Abuse Protection，不能进入仓库或 `NEXT_PUBLIC_` 环境变量。

部署前运行：

```powershell
pnpm check:production
```

部署后进行两层探测：

- `GET /api/health`：公开存活检查，只返回状态、时间和可选提交编号。
- `GET /api/health?deep=1`：请求头携带 `Authorization: Bearer <HEALTHCHECK_SECRET>`，验证全部生产配置、Supabase 连接、用量迁移和汇总函数；未就绪返回 HTTP 503。

应让 Vercel、UptimeRobot 或其他监控服务每 5 分钟检查公开端点，并由受信任的监控任务定期检查深度端点。HTTP 503、错误率上升或预算 80% 告警都应通知管理员。

邮箱确认与密码恢复使用 SSR/PKCE 回调。请在 Supabase Authentication 中：

- 将 Site URL 设为正式站点域名。
- 将 `http://localhost:3000/auth/confirm`、`http://localhost:3000/auth/update-password` 以及对应正式域名加入 Redirect URLs。
- 默认邮件模板会跟随代码传入的回调地址，无需修改即可完成注册确认和密码恢复。若需要自定义品牌模板，应先配置自定义 SMTP。
- 正式开放注册前配置自定义 SMTP 与 CAPTCHA；Supabase 默认邮件服务只适合开发测试。

每次提交或拉取请求都会运行 `.github/workflows/quality.yml`，检查类型、Lint、Agent 合约测试、生产构建和浏览器主流程。Supabase 变更还会运行 pgTAP 数据库测试；CodeQL 与 Dependabot 负责持续代码和依赖安全检查。

## 4. Supabase 上线验收与备份

正式开放注册前，在 Supabase 控制台完成：

1. Security Advisor 无未处理的高危项，并确认所有暴露表同时具备显式权限和 RLS。
2. 配置自定义 SMTP、正式 Site URL/Redirect URLs、Auth Rate Limits 与 Cloudflare Turnstile CAPTCHA；前端 Site Key 写入部署环境，Secret Key 只写入 Supabase 控制台。
3. 用两个专用账号运行 `pnpm test:supabase:live`，保留通过时间和对应 Git 提交编号。
4. 在 Database → Backups 确认可用恢复点。免费方案应定期使用 Supabase CLI `db dump` 导出并保存到项目之外的受控备份位置。
5. 至少做一次恢复演练：恢复到独立测试项目，重新执行双账号隔离测试；不要直接拿生产项目做首次恢复演练。

数据库备份不等于 Storage 文件备份；当前项目尚未把简历文件写入 Supabase Storage，因此现阶段主要备份对象是数据库工作区快照和配置记录。

## 尚需账号所有者完成的外部步骤

Codex 无法仅凭仓库代码确认 Supabase Security Advisor、SMTP、CAPTCHA、备份恢复点、Vercel 告警和 GitHub Secrets 已在账号控制台生效。仓库内代码、迁移、健康检查和验证工作流已经准备好；只有上述控制台步骤完成并通过深度健康检查与双账号测试后，才应标记为“可公开使用”。
