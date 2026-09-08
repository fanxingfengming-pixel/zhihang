"use client";

import { CheckCircle2, DatabaseBackup, Download, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearLocalAppData, exportPortableWorkspace } from "@/lib/local-data-manager";

type Status = { type: "idle" | "success" | "error"; message: string };

export function DataManagementPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const [busy, setBusy] = useState(false);

  function downloadBackup() {
    try {
      const snapshot = exportPortableWorkspace();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `zhihang-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus({ type: "success", message: "完整本机备份已下载，请妥善保管，其中可能包含个人求职信息。" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "备份导出失败" });
    }
  }

  async function clearLocalData() {
    if (!window.confirm("这会清除当前浏览器中的求职档案、投递、面试、Offer、自定义 JD 和模型同意记录。云端数据不会被删除。是否继续？")) return;
    setBusy(true);
    try {
      await fetch("/api/settings/ai", { method: "DELETE" });
      if (!clearLocalAppData()) throw new Error("部分浏览器数据未能删除，请检查浏览器存储权限。");
      router.replace("/");
      router.refresh();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "本机数据清除失败" });
      setBusy(false);
    }
  }

  return (
    <section className="data-management-card" id="data-management">
      <header>
        <span><DatabaseBackup size={20} /></span>
        <div><h2>数据管理</h2><p>导出当前浏览器中的完整求职数据，或清除本机副本。</p></div>
      </header>
      <div className="data-management-body">
        <div className="data-management-copy"><ShieldCheck size={18} /><p><b>备份文件可能包含个人信息</b><span>文件包含 Career Profile、投递、训练记录、自定义 JD、Offer 草稿和岗位收藏；不会包含 API 密钥。</span></p></div>
        <div className="data-management-actions">
          <button type="button" className="secondary-button" onClick={downloadBackup} disabled={busy}><Download size={15} />下载完整备份</button>
          <button type="button" className="danger-button" onClick={() => void clearLocalData()} disabled={busy}><Trash2 size={15} />{busy ? "正在清除…" : "清除本机数据"}</button>
        </div>
      </div>
      {status.message ? <p className={`settings-status ${status.type}`} role="status"><CheckCircle2 size={15} />{status.message}</p> : null}
    </section>
  );
}
