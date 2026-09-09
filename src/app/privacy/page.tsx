import Link from "next/link";
import { AppShell, PageHeading } from "@/components/ui/app-shell";

export default function PrivacyPage() {
  return (
    <AppShell>
      <PageHeading eyebrow="数据与隐私" title="隐私说明" description="说明职航会处理哪些求职数据、数据去向以及你可以执行的控制。" />
      <article className="legal-card">
        <p className="legal-updated">更新日期：2026 年 9 月 8 日</p>
        <h2>我们处理的数据</h2>
        <p>为了生成求职训练结果，系统会处理你主动提供的简历、Career Profile、岗位 JD、面试回答、投递记录、Offer 信息和产品设置。请不要填写身份证号、银行卡、账号密码或与求职无关的敏感信息。</p>
        <h2>本机与云端存储</h2>
        <p>未登录时，工作区主要保存在当前浏览器。启用 Supabase 并主动上传后，工作区快照会保存到云端，并通过行级安全策略按账号隔离。模型 API 密钥不会进入 Career Profile、备份文件或 Supabase 工作区快照。</p>
        <h2>第三方模型</h2>
        <p>演示模式不会发送材料给模型服务商。真实模式只有在你明确同意并主动执行 Agent 时，才会把当前任务必要内容发送给你选择的 DeepSeek 或通义千问。服务商对请求数据的处理还受其自身条款和隐私政策约束。</p>
        <h2>保留、导出与删除</h2>
        <p>本机数据由浏览器存储控制；你可以在设置页下载备份或清除。云端工作区会保留到你删除云端数据或永久删除账号。删除账号后，数据库中的关联工作区与配额记录会随账号删除。</p>
        <h2>安全边界</h2>
        <p>系统采用输入大小限制、结构化输出校验、模型密钥隔离、请求限流和 Supabase RLS，但任何互联网服务都无法承诺绝对安全。请在使用 AI 结果前核对事实。</p>
        <p className="legal-links"><Link href="/terms">查看使用条款</Link><Link href="/settings#cloud-sync">管理我的数据</Link></p>
      </article>
    </AppShell>
  );
}
