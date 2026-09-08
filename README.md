# 职航——大学生 AI 求职实训智能体空间

一个可本地运行的 Next.js 求职产品 Demo。当前首页与三项核心任务已统一为同一套浅蓝灰编辑式 Design System：

- `/`：首页与求职状态概览
- `/career`：求职目标、成长数据与纵向求职流程
- `/jobs`：岗位列表、JD 详情与 AI 匹配分析
- `/workspace`：结构化简历编辑、AI 优化建议与对话助手
- `/interview`：基于目标岗位的模拟面试、单题评分与追问
- `/applications`：投递流水线、下一步管理与 Offer 比较
- `/settings`：DeepSeek / 通义千问接口配置与连接测试

内置岗位列表仍使用 Mock Data，不会抓取招聘网站；用户可以粘贴任意真实 JD 并完成解析、匹配和加入投递中心。十个独立 Agent 已接入任务型 UI，可通过服务端调用真实大模型：

1. **简历构建 Agent**：把基础信息、技能和零散经历整理为基础简历与结构化档案。
2. **JD 解析 Agent**：提取岗位职责、硬性要求、加分项与关键词。
3. **岗位匹配 Agent**：基于档案和 JD 给出证据化匹配分、能力差距与行动建议。
4. **简历优化 Agent**：结合档案、JD 与匹配报告生成定向版本，并在应用前检查新增数字与证据来源。
5. **面试训练 Agent**：根据档案、JD 与差距生成岗位题单，并对单题真实回答进行证据化反馈。
6. **职业定位 Agent**：基于档案证据提出相邻岗位方向与低成本验证实验。
7. **能力诊断 Agent**：区分已有证据与关键差距，给出证据完整度评分。
8. **提升计划 Agent**：把高优先级差距拆成最多四周的任务、交付物和验收方式。
9. **投递管理 Agent**：读取本地投递流水线，整理优先行动、跟进事项和记录风险。
10. **Offer 决策 Agent**：只根据用户填写的已确认条款比较 Offer，并列出需要继续核实的问题。

当前版本不依赖任何付费第三方智能体平台。没有配置模型密钥时，会自动使用内置演示引擎，因此克隆后即可跑通全部流程。账号与云同步为可选增强项：不配置 Supabase 时继续使用浏览器本地存储，不影响十个 Agent。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS
- Next.js Route Handlers
- Zod 运行时数据校验
- DeepSeek / 通义千问 OpenAI 兼容接口
- PDF / DOCX / TXT / Markdown 简历文本提取
- 浏览器 `localStorage` 本地持久化
- 可选 Supabase Auth + PostgreSQL 云端同步（RLS 用户隔离）
- Vitest Agent 合约测试 + Playwright 主流程测试

## 本地启动

需要 Node.js 20.9 或更高版本。

```bash
pnpm install
Copy-Item .env.example .env.local   # Windows PowerShell
pnpm dev
```

然后打开 [http://localhost:3000](http://localhost:3000)。macOS / Linux 可用 `cp .env.example .env.local`。

## 配置模型

编辑 `.env.local`，至少填写一组密钥：

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的密钥
```

或：

```dotenv
AI_PROVIDER=qwen
QWEN_API_KEY=你的百炼密钥
```

也可以在网站“设置”页面切换提供商、填写接口地址、模型和密钥并测试连接。通过页面填写的密钥只保存在本地服务运行内存中，不会写入网页源码或浏览器长期存储；服务重启后需要重新填写。

### 千问地域地址

`.env.example` 默认使用仍可用的公共兼容地址。阿里云百炼目前推荐地域专属地址；获得业务空间 ID 后，可按控制台信息设置：

```dotenv
QWEN_BASE_URL=https://你的WorkspaceId.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
```

若账号使用其他地域，请使用对应地域地址。模型名称同样可通过 `QWEN_MODEL` 和 `DEEPSEEK_MODEL` 覆盖。

## 演示模式

- `DEMO_MODE=false`：有当前提供商密钥时调用真实模型；没有密钥时自动回退演示引擎。
- `DEMO_MODE=true`：始终使用本地演示引擎，不产生 API 费用。
- 生产环境默认只允许登录用户使用服务端共享模型密钥；未配置 Supabase 时，请让用户在设置页填写自己的密钥。只有明确接受匿名调用费用风险时才可设置 `ALLOW_PUBLIC_AI_API=true`。
- 使用真实模型前，用户必须在设置页明确确认数据发送说明；演示模式不会向 DeepSeek 或通义千问发送求职材料。

演示引擎用于验证产品流程，并不等价于真实模型的语义分析质量。

## 可选账号与云同步

不填写 Supabase 环境变量时，设置页会显示“未启用”，项目保持纯本地模式。需要跨设备同步时，在 `.env.local` 填写：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=你的项目地址
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的公开密钥
```

然后执行 `supabase/migrations/202609070001_initial_workspace.sql`。登录与同步入口位于 `/settings#cloud-sync`；同步内容包括 Career Profile、投递、职业报告、面试记录和 Offer 对比记录，不包括 DeepSeek/Qwen API 密钥，也不包括用户粘贴的自定义 JD。完整步骤见 `DEPLOYMENT.md`。

## 数据结构

统一档案定义在 `src/lib/schemas.ts`：

```ts
type CareerProfile = {
  basics: {
    name: string;
    school: string;
    major: string;
    grade: string;
    targetRole: string;
    location: string;
  };
  skills: string[];
  strengths: string[];
  projects: Experience[];
  resumeMarkdown: string;
  updatedAt: string;
};
```

十个 Agent 的输出都经过 Zod 校验和统一事实守卫。简历 Agent 写入档案；其余 Agent 读取同一 Career Profile 以及上游结构化结果。优化 Agent 只允许基于档案证据改写，并由服务端保留身份、学校、技能和项目元数据。

实际页面链路为：

1. AI 工作区回答 6 个问题，调用 `resume` 并保存 Career Profile。
2. 岗位页选择岗位，调用 `jd` 将岗位原文转换为结构化 JD。
3. 页面将 Career Profile 与 JD 交给 `match`，动态展示综合分、四个维度、优势和差距。
4. AI 工作区按需调用 `optimize`，通过事实检查后才允许将定向版本写回 Career Profile。
5. 面试页调用 `interview` 生成题目，并在用户提交单题回答后进行评分与追问。
6. 求职中心依次调用 `career`、`gap`、`plan`，生成职业定位、能力诊断和四周提升计划。
7. 投递中心将浏览器本地记录交给 `application` 整理下一步；Offer 区调用 `offer` 比较用户已填写的条款。

岗位分析按“岗位 + 档案更新时间”缓存在当前浏览器会话，避免页面跳转时重复产生模型费用；点击“重新分析当前岗位”可强制刷新。

## API

统一端点：`POST /api/agents/[agent]`，其中 `[agent]` 为：

- `resume`
- `jd`
- `match`
- `optimize`
- `interview`
- `career`
- `gap`
- `plan`
- `application`
- `offer`

请求格式：

```json
{
  "provider": "deepseek",
  "input": {},
  "context": {}
}
```

响应包含结构化 `data` 与 `meta.demo` 运行模式标记。

## 验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

如需用真实模型对 10 个 Agent 各执行一次基线冒烟评测，可在已配置 API 密钥后运行：

```powershell
$env:LIVE_AI_PROVIDER="qwen" # 或 deepseek
pnpm test:evals:live
```

该命令会发起 10 次模型请求并产生对应 API 用量；常规 `pnpm test` 与 CI 不会运行这些真实请求。

## MVP 边界与下一步

未配置 Supabase 时，数据只保存在当前浏览器；配置后支持账号与单用户工作区跨设备同步。当前同步采用每用户一份 JSONB 快照，并使用更新时间做冲突检测，适合 MVP，但不提供多人实时协作或逐条历史版本。自定义 JD、Offer 草稿和岗位收藏会包含在用户主动下载的完整本机备份中，但不进入云同步。岗位列表仍是演示数据，真实岗位需由用户粘贴 JD；AI 工作区的自由对话仍是引导式交互；系统不会自动投递、发送邮件或联系招聘方。后续可继续增加合规岗位源、简历 PDF 导出、文件对象存储和团队协作。
