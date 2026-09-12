"use client";

import { ArrowRight, CheckCircle2, KeyRound, LoaderCircle, LockKeyhole, Mail, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { TurnstileCaptcha } from "@/components/turnstile-captcha";
import { buildAuthCallbackUrl, PENDING_VERIFICATION_EMAIL_KEY, safeInternalPath } from "@/lib/auth-navigation";
import { bindLocalWorkspaceToUser } from "@/lib/local-data-manager";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";
type Status = { type: "idle" | "success" | "error"; message: string };

function authErrorMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "邮箱或密码不正确。";
  if (/email not confirmed/i.test(message)) return "请先打开验证邮件完成邮箱确认。";
  if (/user already registered/i.test(message)) return "该邮箱已经注册，请直接登录。";
  if (/password/i.test(message)) return "密码至少需要 8 位，请检查后重试。";
  return "账号操作失败，请稍后重试。";
}

export function LoginForm({
  configured,
  nextPath,
  initialMode = "signin",
  captchaSiteKey = "",
  initialMessage = "",
}: {
  configured: boolean;
  nextPath: string;
  initialMode?: AuthMode;
  captchaSiteKey?: string;
  initialMessage?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => configured ? createClient() : null, [configured]);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [status, setStatus] = useState<Status>(
    initialMessage ? { type: "error", message: initialMessage } : { type: "idle", message: "" },
  );
  const handleCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);
  const destination = safeInternalPath(nextPath);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || (typeof window === "undefined" ? "http://localhost:3000" : window.location.origin);

  function resetCaptcha() {
    setCaptchaToken("");
    setCaptchaResetKey((value) => value + 1);
  }

  function enterWorkspace(userId: string) {
    bindLocalWorkspaceToUser(userId);
    router.replace(destination);
    router.refresh();
  }

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setStatus({ type: "error", message: "登录服务尚未配置，请联系管理员。" });
      return;
    }
    if (!email.trim() || password.length < 8) {
      setStatus({ type: "error", message: "请输入有效邮箱，密码至少 8 位。" });
      return;
    }
    if (captchaSiteKey && !captchaToken) {
      setStatus({ type: "error", message: "请先完成安全验证。" });
      return;
    }

    setBusy(true);
    setStatus({ type: "idle", message: "" });
    const result = mode === "signup"
      ? await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: buildAuthCallbackUrl(siteUrl, destination),
          captchaToken: captchaToken || undefined,
        },
      })
      : await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: { captchaToken: captchaToken || undefined },
      });
    resetCaptcha();
    setBusy(false);

    if (result.error) {
      setStatus({ type: "error", message: authErrorMessage(result.error.message) });
      return;
    }
    if (result.data.session && result.data.user) {
      enterWorkspace(result.data.user.id);
      return;
    }
    window.sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, email.trim());
    router.replace(`/verify-email?next=${encodeURIComponent(destination)}`);
  }

  async function resetPassword() {
    if (!supabase) {
      setStatus({ type: "error", message: "登录服务尚未配置，请联系管理员。" });
      return;
    }
    if (!email.trim()) {
      setStatus({ type: "error", message: "请先填写需要找回密码的邮箱。" });
      return;
    }
    if (captchaSiteKey && !captchaToken) {
      setStatus({ type: "error", message: "请先完成安全验证。" });
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: buildAuthCallbackUrl(siteUrl, "/auth/update-password"),
      captchaToken: captchaToken || undefined,
    });
    resetCaptcha();
    setBusy(false);
    setStatus(error
      ? { type: "error", message: "密码重置邮件发送失败，请稍后重试。" }
      : { type: "success", message: "如果该邮箱已注册，重置邮件会很快发送。" });
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="职航产品介绍">
        <Link className="login-brand" href="/login">
          <span className="brand-mark">Z</span>
          <span><b>职航</b><small>CAREER PILOT</small></span>
        </Link>
        <div className="login-story-copy">
          <p className="eyebrow">AI CAREER TRAINING SPACE</p>
          <h1>让每一次求职准备，<br /><em>都沉淀为你的成长。</em></h1>
          <p>一个账号，一份持续更新的 Career Profile。简历、岗位、面试与投递记录只属于你。</p>
          <div className="login-trust">
            <span><LockKeyhole size={16} />账号数据独立隔离</span>
            <span><CheckCircle2 size={16} />训练结果持续复用</span>
          </div>
        </div>
        <p className="login-quote">Keep moving toward your offer.</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <header>
            <p className="eyebrow">WELCOME TO ZHIHANG</p>
            <h2>{mode === "signin" ? "登录你的求职空间" : "创建职航账号"}</h2>
            <p>{mode === "signin" ? "继续完善你的档案、训练和投递进度。" : "建立独立档案，开启完整的 AI 求职实训。"}</p>
          </header>

          <div className="login-mode-tabs" role="tablist" aria-label="账号操作">
            <button type="button" role="tab" className={mode === "signin" ? "active" : ""} aria-selected={mode === "signin"} onClick={() => { setMode("signin"); setStatus({ type: "idle", message: "" }); }}>登录</button>
            <button type="button" role="tab" className={mode === "signup" ? "active" : ""} aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setStatus({ type: "idle", message: "" }); }}>注册</button>
          </div>

          <form className="login-form" onSubmit={authenticate}>
            <label>
              <span>邮箱</span>
              <div><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" required /></div>
            </label>
            <label>
              <span>密码</span>
              <div><KeyRound size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="至少 8 位" minLength={8} required /></div>
            </label>
            {captchaSiteKey ? <TurnstileCaptcha siteKey={captchaSiteKey} resetKey={captchaResetKey} onToken={handleCaptchaToken} /> : null}
            {status.message ? <p className={`login-status ${status.type}`} role="status">{status.type === "success" ? <CheckCircle2 size={15} /> : <LockKeyhole size={15} />}{status.message}</p> : null}
            <button className="login-submit" type="submit" disabled={busy || !configured}>
              {busy ? <><LoaderCircle className="spin" size={17} />正在处理…</> : mode === "signin" ? <>进入职航 <ArrowRight size={17} /></> : <><UserPlus size={17} />创建账号</>}
            </button>
          </form>

          <footer>
            {mode === "signin" ? <button type="button" onClick={resetPassword} disabled={busy}>忘记密码？</button> : <span>注册后即可建立个人 Career Profile</span>}
            <p>登录即表示你同意按账号隔离并保存自己的求职数据。</p>
          </footer>
        </div>
      </section>
    </main>
  );
}
