"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PENDING_VERIFICATION_EMAIL_KEY, safeInternalPath } from "@/lib/auth-navigation";

export function EmailConfirmedCard({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const destination = safeInternalPath(nextPath);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    window.sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
    const timer = window.setInterval(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1_000);
    const redirectTimer = window.setTimeout(() => {
      router.replace(destination);
      router.refresh();
    }, 3_000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(redirectTimer);
    };
  }, [destination, router]);

  function enterWorkspace() {
    router.replace(destination);
    router.refresh();
  }

  return (
    <main className="auth-result-page">
      <section className="auth-result-card">
        <span className="auth-result-icon success"><CheckCircle2 size={30} /></span>
        <p className="eyebrow">EMAIL CONFIRMED</p>
        <h1>邮箱确认成功</h1>
        <p className="auth-result-copy">账号已经激活。接下来产生的 Career Profile、简历、岗位、面试与投递记录都会保存到你的个人空间。</p>
        <button className="login-submit" type="button" onClick={enterWorkspace}>进入职航 <ArrowRight size={17} /></button>
        <p className="auth-result-countdown">{countdown} 秒后自动进入</p>
      </section>
    </main>
  );
}
