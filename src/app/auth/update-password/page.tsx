"use client";

import { CheckCircle2, KeyRound } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AppShell, PageHeading } from "@/components/ui/app-shell";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [busy, setBusy] = useState(false);

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setStatus({ type: "error", message: "新密码至少需要 8 位。" });
      return;
    }
    if (password !== confirmation) {
      setStatus({ type: "error", message: "两次输入的密码不一致。" });
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setStatus({ type: "error", message: "密码更新失败，请重新打开最新的重置邮件链接。" });
      return;
    }
    setPassword("");
    setConfirmation("");
    setStatus({ type: "success", message: "密码已更新，可以返回设置页继续使用。" });
  }

  return (
    <AppShell>
      <PageHeading eyebrow="账号安全" title="设置新密码" description="只有通过有效的 Supabase 密码恢复链接才能完成更新。" />
      <form className="settings-card auth-update-card" onSubmit={updatePassword}>
        <section className="settings-section">
          <div className="settings-section-title"><span>01</span><div><h3>新密码</h3><p>建议使用至少 8 位且不与其他网站重复的密码。</p></div></div>
          <div className="settings-fields">
            <label className="wide"><span>输入新密码</span><div className="secret-field"><KeyRound size={15} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></div></label>
            <label className="wide"><span>再次输入</span><div className="secret-field"><KeyRound size={15} /><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" /></div></label>
          </div>
        </section>
        {status.message ? <p className={`settings-status ${status.type}`} role="status"><CheckCircle2 size={15} />{status.message}</p> : null}
        <footer className="settings-actions"><Link className="text-button compact" href="/settings#cloud-sync">返回设置</Link><button className="primary-button" type="submit" disabled={busy}>{busy ? "正在更新…" : "更新密码"}</button></footer>
      </form>
    </AppShell>
  );
}
