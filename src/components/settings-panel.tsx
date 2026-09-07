"use client";

import { CheckCircle2, Eye, EyeOff, KeyRound, RefreshCw, Save, ServerCog, ShieldCheck, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Provider } from "@/lib/ai/client";

export type AISettingsView = {
  provider: Provider;
  baseUrl: string;
  model: string;
  demoMode: boolean;
  hasApiKey: boolean;
};

const providerDefaults: Record<Provider, Pick<AISettingsView, "baseUrl" | "model">> = {
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash" },
  qwen: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
};

type Status = { type: "success" | "error" | "idle"; message: string };

export function SettingsPanel({ initial, fallback }: { initial: AISettingsView; fallback: AISettingsView }) {
  const [settings, setSettings] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  function changeProvider(provider: Provider) {
    setSettings((current) => ({ ...current, provider, ...providerDefaults[provider], hasApiKey: false }));
    setApiKey("");
    setStatus({ type: "idle", message: "" });
  }

  async function saveSettings(event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setStatus({ type: "idle", message: "" });
    try {
      const response = await fetch("/api/settings/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, apiKey: apiKey.trim() || undefined }),
      });
      const payload = (await response.json()) as { ok?: boolean; hasApiKey?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败");
      setSettings((current) => ({ ...current, hasApiKey: Boolean(payload.hasApiKey || current.hasApiKey) }));
      setApiKey("");
      setStatus({ type: "success", message: settings.demoMode ? "已保存，当前使用零费用演示模式" : "API 设置已保存到本次服务会话" });
      return true;
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "保存失败" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    const saved = await saveSettings();
    if (!saved) { setTesting(false); return; }
    try {
      const response = await fetch("/api/settings/ai/test", { method: "POST" });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "连接失败");
      setStatus({ type: "success", message: payload.message || "连接成功" });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "连接失败" });
    } finally {
      setTesting(false);
    }
  }

  async function resetSettings() {
    await fetch("/api/settings/ai", { method: "DELETE" });
    setSettings(fallback);
    setApiKey("");
    setStatus({ type: "success", message: "本次会话设置已恢复为服务端默认值" });
  }

  return (
    <div className="settings-layout">
      <aside className="settings-index" aria-label="设置分类">
        <p>设置分类</p>
        <button className="active"><ServerCog size={17} />AI 接口</button>
        <button disabled><Sparkles size={17} />界面偏好<span>即将开放</span></button>
      </aside>

      <form className="settings-card" onSubmit={saveSettings}>
        <header className="settings-card-head">
          <div><span><ServerCog size={20} /></span><div><h2>AI 接口设置</h2><p>配置后，简历分析与岗位匹配可调用真实模型。</p></div></div>
          <span className={`api-state ${settings.demoMode ? "demo" : settings.hasApiKey ? "ready" : "waiting"}`}><i />{settings.demoMode ? "演示模式" : settings.hasApiKey ? "密钥已配置" : "等待配置"}</span>
        </header>

        <section className="settings-section">
          <div className="settings-section-title"><span>01</span><div><h3>运行方式</h3><p>调试界面已经隐藏，这里只保留职航自己的中文选项。</p></div></div>
          <label className="toggle-row"><div><b>使用演示模式</b><small>开启后使用本地演示数据，不会产生接口费用。</small></div><input type="checkbox" checked={settings.demoMode} onChange={(event) => setSettings((current) => ({ ...current, demoMode: event.target.checked }))} /><span aria-hidden="true" /></label>
        </section>

        <section className="settings-section">
          <div className="settings-section-title"><span>02</span><div><h3>接口连接</h3><p>支持兼容 OpenAI 请求格式的 DeepSeek 与通义千问。</p></div></div>
          <div className="settings-fields">
            <label><span>接口服务商</span><select value={settings.provider} onChange={(event) => changeProvider(event.target.value as Provider)} disabled={settings.demoMode}><option value="deepseek">深度求索（DeepSeek）</option><option value="qwen">通义千问（阿里云百炼）</option></select></label>
            <label><span>模型名称</span><input value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))} disabled={settings.demoMode} placeholder="请输入模型名称" /></label>
            <label className="wide"><span>接口地址</span><input value={settings.baseUrl} onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))} disabled={settings.demoMode} placeholder="请输入完整接口地址" /></label>
            <label className="wide"><span>接口密钥</span><div className="secret-field"><KeyRound size={15} /><input type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={settings.demoMode} placeholder={settings.hasApiKey ? "密钥已配置；留空可继续使用" : "请输入接口密钥"} autoComplete="off" /><button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "隐藏接口密钥" : "显示接口密钥"}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          </div>
          <div className="security-note"><ShieldCheck size={17} /><p><b>密钥不会写入网页源码或浏览器长期存储。</b><span>当前版本仅保存在本地服务的运行内存中，服务重启后需要重新填写；生产部署应改用服务端环境变量或密钥管理服务。</span></p></div>
        </section>

        {status.message ? <p className={`settings-status ${status.type}`} role="status"><CheckCircle2 size={15} />{status.message}</p> : null}
        <footer className="settings-actions"><button type="button" className="text-button compact" onClick={resetSettings}>恢复默认设置</button><button type="button" className="secondary-button" onClick={testConnection} disabled={testing || saving}><RefreshCw size={15} className={testing ? "spin" : ""} />{testing ? "正在测试…" : "测试连接"}</button><button type="submit" className="primary-button" disabled={saving || testing}><Save size={15} />{saving ? "正在保存…" : "保存设置"}</button></footer>
      </form>
    </div>
  );
}
