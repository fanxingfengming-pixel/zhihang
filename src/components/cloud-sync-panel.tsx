"use client";

import { CheckCircle2, CloudDownload, CloudUpload, Database, LoaderCircle, LogIn, LogOut, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { exportWorkspaceSnapshot, hasLocalWorkspaceBackup, importWorkspaceSnapshot, restoreLocalWorkspaceBackup, type WorkspaceSnapshot } from "@/lib/workspace-sync";

type Status = { type: "idle" | "success" | "error"; message: string };

export function CloudSyncPanel({ configured }: { configured: boolean }) {
  if (!configured) {
    return (
      <section className="cloud-settings-card" id="cloud-sync">
        <header>
          <span><Database size={20} /></span>
          <div><h2>账号与云同步</h2><p>本地模式正常运行；连接 Supabase 后可跨设备恢复求职档案与训练记录。</p></div>
          <em className="api-state waiting"><i />未启用</em>
        </header>
        <div className="cloud-setup-copy">
          <ShieldCheck size={21} />
          <div>
            <b>当前数据仅保存在这个浏览器</b>
            <p>清理浏览器数据或更换设备可能造成丢失。需要跨设备备份时，请配置 Supabase 并执行项目内的数据库迁移。</p>
            <span className="cloud-doc-hint">具体步骤见项目根目录的 DEPLOYMENT.md</span>
          </div>
        </div>
      </section>
    );
  }

  return <ConfiguredCloudSyncPanel />;
}

function ConfiguredCloudSyncPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [hasBackup, setHasBackup] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setCurrentEmail(data.user?.email || null);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentEmail(session?.user.email || null);
      setChecking(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setHasBackup(hasLocalWorkspaceBackup());
      if (!currentEmail) {
        setCloudUpdatedAt(null);
        return;
      }
      fetch("/api/sync")
        .then(async (response) => {
          const payload = (await response.json()) as { updatedAt?: string | null };
          if (active && response.ok) setCloudUpdatedAt(payload.updatedAt || null);
        })
        .catch(() => undefined);
    });
    return () => { active = false; };
  }, [currentEmail]);

  async function authenticate(mode: "signin" | "signup") {
    if (!email.trim() || password.length < 6) {
      setStatus({ type: "error", message: "请输入有效邮箱，密码至少 6 位。" });
      return;
    }
    setBusy(true);
    setStatus({ type: "idle", message: "" });
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) {
      setStatus({ type: "error", message: result.error.message });
      return;
    }
    setPassword("");
    setStatus({
      type: "success",
      message: result.data.session ? "登录成功，可以开始同步。" : "注册成功，请先到邮箱完成验证。",
    });
  }

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    setStatus(error ? { type: "error", message: error.message } : { type: "success", message: "已退出账号，本机数据仍然保留。" });
  }

  async function upload() {
    setBusy(true);
    setStatus({ type: "idle", message: "" });
    try {
      const response = await fetch("/api/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: exportWorkspaceSnapshot(), expectedUpdatedAt: cloudUpdatedAt }),
      });
      const payload = (await response.json()) as { updatedAt?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "上传失败");
      setCloudUpdatedAt(payload.updatedAt || null);
      setStatus({ type: "success", message: "本机工作区已安全同步到云端。" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "上传失败" });
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!window.confirm("云端数据将覆盖当前浏览器中的工作区。覆盖前会在本机自动留一份备份，是否继续？")) return;
    setBusy(true);
    setStatus({ type: "idle", message: "" });
    try {
      const response = await fetch("/api/sync");
      const payload = (await response.json()) as { data?: WorkspaceSnapshot | null; updatedAt?: string | null; error?: string };
      if (!response.ok) throw new Error(payload.error || "下载失败");
      if (!payload.data) throw new Error("云端还没有工作区数据，请先从一台设备上传。\n");
      importWorkspaceSnapshot(payload.data);
      setHasBackup(true);
      setCloudUpdatedAt(payload.updatedAt || null);
      setStatus({ type: "success", message: "云端工作区已恢复到本机，页面数据已更新。" });
    } catch (error) {
      setHasBackup(hasLocalWorkspaceBackup());
      setStatus({ type: "error", message: error instanceof Error ? error.message.trim() : "下载失败" });
    } finally {
      setBusy(false);
    }
  }

  function restoreBackup() {
    try {
      if (!restoreLocalWorkspaceBackup()) throw new Error("没有可恢复的本机备份。");
      setHasBackup(false);
      setStatus({ type: "success", message: "已恢复云端覆盖前的本机工作区。" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "本机备份恢复失败" });
    }
  }

  async function deleteCloudData() {
    if (!window.confirm("这会永久删除当前账号的云端工作区快照，但保留当前浏览器中的数据和账号。是否继续？")) return;
    setBusy(true);
    setStatus({ type: "idle", message: "" });
    try {
      const response = await fetch("/api/sync", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "删除失败");
      setCloudUpdatedAt(null);
      setStatus({ type: "success", message: "云端工作区快照已删除，本机数据仍然保留。" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "云端数据删除失败" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cloud-settings-card" id="cloud-sync">
      <header>
        <span><Database size={20} /></span>
        <div><h2>账号与云同步</h2><p>使用 Supabase Auth 登录，并通过行级权限隔离每个用户的工作区。</p></div>
        <em className={`api-state ${currentEmail ? "ready" : "waiting"}`}><i />{checking ? "检查中" : currentEmail ? "已登录" : "等待登录"}</em>
      </header>

      {checking ? <div className="cloud-loading"><LoaderCircle className="spin" size={20} />正在确认账号状态…</div> : currentEmail ? (
        <div className="cloud-account-body">
          <div className="cloud-account-line">
            <div><b>{currentEmail}</b><span>{cloudUpdatedAt ? `最近同步：${new Date(cloudUpdatedAt).toLocaleString("zh-CN")}` : "尚未在本次会话同步"}</span></div>
            <button type="button" className="text-button compact" onClick={signOut} disabled={busy}><LogOut size={14} />退出账号</button>
          </div>
          <div className="cloud-sync-actions">
            <button type="button" className="primary-button" onClick={upload} disabled={busy}><CloudUpload size={16} />上传本机数据</button>
            <button type="button" className="secondary-button" onClick={download} disabled={busy}><CloudDownload size={16} />从云端恢复</button>
            {hasBackup ? <button type="button" className="secondary-button" onClick={restoreBackup} disabled={busy}>撤销上次云端恢复</button> : null}
            <button type="button" className="danger-button" onClick={() => void deleteCloudData()} disabled={busy}><Trash2 size={15} />删除云端数据</button>
          </div>
          <p className="cloud-safety"><ShieldCheck size={15} />恢复前自动备份当前本机数据；模型 API 密钥不会进入同步快照。</p>
        </div>
      ) : (
        <form className="cloud-login-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void authenticate("signin"); }}>
          <label><span>邮箱</span><input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" spellCheck={false} placeholder="name@example.com" /></label>
          <label><span>密码</span><input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="至少 6 位…" /></label>
          <div>
            <button type="submit" className="primary-button" disabled={busy}><LogIn size={15} />登录</button>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => authenticate("signup")}><UserPlus size={15} />注册</button>
          </div>
        </form>
      )}

      {status.message ? <p className={`settings-status ${status.type}`} role="status"><CheckCircle2 size={15} />{status.message}</p> : null}
    </section>
  );
}
