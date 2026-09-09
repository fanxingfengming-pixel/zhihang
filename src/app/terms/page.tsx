import Link from "next/link";
import { AppShell, PageHeading } from "@/components/ui/app-shell";

export default function TermsPage() {
  return (
    <AppShell>
      <PageHeading eyebrow="使用边界" title="使用条款" description="职航提供求职训练辅助，不替代个人核验、招聘方决定或专业意见。" />
      <article className="legal-card">
        <p className="legal-updated">更新日期：2026 年 9 月 8 日</p>
        <h2>产品定位</h2>
        <p>职航用于简历整理、岗位分析、匹配解释、面试训练、投递管理和 Offer 比较。评分只反映现有材料的证据完整度或规则匹配，不代表录用概率、薪酬承诺或招聘结果。</p>
        <h2>真实性责任</h2>
        <p>你应核对并只使用真实、可验证的经历。不得利用系统伪造教育、实习、项目、证书、薪酬或其他求职信息。</p>
        <h2>高影响操作</h2>
        <p>系统不会自动投递、发送邮件、签署文件或联系招聘方。投递、接受 Offer、签约和提供个人资料前，应由你本人确认。</p>
        <h2>AI 输出限制</h2>
        <p>模型可能产生遗漏、误解或过时内容。岗位条款、薪酬、劳动合同、法律或财务问题应以正式书面文件和有资质的专业人士意见为准。</p>
        <h2>合理使用</h2>
        <p>不得绕过限流、批量消耗共享模型额度、攻击系统、访问其他用户数据或提交恶意文件。违反安全边界的请求可能被拒绝。</p>
        <p className="legal-links"><Link href="/privacy">查看隐私说明</Link><Link href="/">返回首页</Link></p>
      </article>
    </AppShell>
  );
}
