"use client";

import { CheckCircle2, LoaderCircle, MailCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { TurnstileCaptcha } from "@/components/turnstile-captcha";
import {
  buildAuthCallbackUrl,
  maskEmail,
  PENDING_VERIFICATION_EMAIL_KEY,
  safeInternalPath,
} from "@/lib/auth-navigation";
import { createClient } from "@/lib/supabase/client";

type Status = { type: "idle" | "success" | "error"; message: string };

export function VerifyEmailForm({
  configured,
  nextPath,
  invalidLink,
  captchaSiteKey = "",
}: {
  configured: boolean;
  nextPath: string;
  invalidLink: boolean;
  captchaSiteKey?: string;
}) {
  const supabase = useMemo(() => configured ? createClient() : null, [configured]);
  const destination = safeInternalPath(nextPath);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [status, setStatus] = useState<Status>(invalidLink
    ? { type: "error", message: "确认链接无效或已经过期，请重新发送确认邮件。" }
    : { type: "idle", message: "" });
  const handleCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);

  useEffect(() => {
    const pendingEmail = window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY) || "";
    const timer = window.setTimeout(() => setEmail(pendingEmail), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function resend(event: FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!supabase || !configured) {
      setStatus({ type: "error", message: "邮件确认服务尚未配置，请联系管理员。" });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setStatus({ type: "error", message: "请输入注册时使用的有效邮箱。" });
      return;
    }
    if (captchaSiteKey && !captchaToken) {
      setStatus({ type: "error", message: "请先完成安全验证。" });
      return;
    }

    setBusy(true);
    setStatus({ type: "idle", message: "" });
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(
          process.env.NEXT_PUBLIC_SITE_URL?.trim() || window.location.origin,
          destination,
        ),
        captchaToken: captchaToken || undefined,
      },
    });
    setBusy(false);
    setCaptchaToken("");
    setCaptchaResetKey((value) => value + 1);
    if (error) {
      const limited = /rate|seconds|security purposes/i.test(error.message);
      setStatus({
        type: "error",
        message: limited ? "发送过于频繁，请稍后再试。" : "确认邮件发送失败，请检查邮箱后重试。",
      });
      return;
    }
    window.sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, normalizedEmail);
    setCooldown(60);
    setStatus({ type: "success", message: "新的确认邮件已发送，请使用最新邮件中的链接。" });
  }

  return (
    <main className="auth-result-page">
      <section className="auth-result-card">
        <span className="auth-result-icon"><MailCheck size={30} /></span>
        <p className="eyebrow">VERIFY YOUR EMAIL</p>
        <h1>{invalidLink ? "重新确认你的邮箱" : "确认邮件已经发送"}</h1>
        <p className="auth-result-copy">
          {email ? <>我们已向 <strong>{maskEmail(email)}</strong> 发送确认邮件。</> : "请打开注册邮箱，点击邮件中的确认链接。"}
          邮件可能需要几分钟到达，也请检查垃圾邮件目录。
        </p>

        <form className="verify-email-form" onSubmit={resend}>
          <label htmlFor="verification-email">没有收到？填写注册邮箱后重新发送</label>
          <input id="verification-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" required />
          {captchaSiteKey ? <TurnstileCaptcha siteKey={captchaSiteKey} resetKey={captchaResetKey} onToken={handleCaptchaToken} /> : null}
          {status.message ? <p className={`login-status ${status.type}`} role="status">{status.type === "success" ? <CheckCircle2 size={15} /> : <MailCheck size={15} />}{status.message}</p> : null}
          <button className="login-submit" type="submit" disabled={busy || cooldown > 0 || !configured}>
            {busy
              ? <><LoaderCircle className="spin" size={17} />正在发送…</>
              : <><RefreshCw size={16} />{cooldown > 0 ? `${cooldown} 秒后可重发` : "重新发送确认邮件"}</>}
          </button>
        </form>

        <div className="auth-result-links">
          <Link href={`/login?next=${encodeURIComponent(destination)}`}>返回登录</Link>
          <Link href={`/login?mode=signup&next=${encodeURIComponent(destination)}`}>更换邮箱</Link>
        </div>
      </section>
    </main>
  );
}
