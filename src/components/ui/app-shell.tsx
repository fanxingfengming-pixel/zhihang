"use client";

import {
  Bell,
  BriefcaseBusiness,
  ClipboardCheck,
  ChevronRight,
  Compass,
  Home,
  Menu,
  MessageCircleMore,
  Mic2,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

const navItems = [
  { href: "/", label: "首页", icon: Home },
  { href: "/career", label: "求职中心", icon: Compass },
  { href: "/jobs", label: "岗位匹配", icon: BriefcaseBusiness },
  { href: "/workspace", label: "AI 工作区", icon: MessageCircleMore },
  { href: "/interview", label: "面试训练", icon: Mic2 },
  { href: "/applications", label: "投递中心", icon: ClipboardCheck },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    if (query) router.push(`/jobs?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="app-frame">
      {open ? <button className="mobile-scrim" onClick={() => setOpen(false)} aria-label="关闭导航" /> : null}
      <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-top">
          <Link className="brand" href="/" onClick={() => setOpen(false)}>
            <span className="brand-mark">Z</span>
            <span><b>职航</b><small>CAREER PILOT</small></span>
          </Link>
          <button className="icon-button sidebar-close" onClick={() => setOpen(false)} aria-label="关闭导航"><X size={19} /></button>
        </div>

        <p className="nav-caption">YOUR JOURNEY</p>
        <nav className="main-nav" aria-label="主导航">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
                {active ? <ChevronRight className="nav-arrow" size={14} /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <Sparkles size={16} />
          <p><b>一步一步，靠近理想 Offer。</b><span>每一次完善都会留下成长的刻度。</span></p>
        </div>
        <div className="sidebar-user">
          <span className="avatar">李</span>
          <p><b>李同学</b><small>浙江大学 · 大三</small></p>
          <Link href="/settings" aria-label="打开设置"><Settings size={16} /></Link>
        </div>
      </aside>

      <section className="app-stage">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setOpen(true)} aria-label="打开导航"><Menu size={20} /></button>
          <form className="topbar-search" onSubmit={submitSearch}>
            <button className="topbar-search-submit" type="submit" aria-label="提交搜索"><Search size={16} /></button>
            <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} aria-label="全局搜索" placeholder="搜索岗位、任务或建议" />
            <kbd>Ctrl K</kbd>
          </form>
          <div className="topbar-actions">
            <span className="status-dot"><i />AI 助手在线</span>
            <button className="icon-button" onClick={() => setNotificationsOpen((value) => !value)} aria-label="通知" aria-expanded={notificationsOpen}><Bell size={18} /><i className="notice-dot" /></button>
            {notificationsOpen ? (
              <div className="notification-panel" role="status">
                <div className="notification-head"><b>最近提醒</b><button onClick={() => setNotificationsOpen(false)} aria-label="关闭通知"><X size={14} /></button></div>
                <p><i />字节跳动岗位匹配度更新至 87%</p>
                <p><i />你的项目经历还有 3 处可量化</p>
                <Link href="/workspace" onClick={() => setNotificationsOpen(false)}>去处理简历建议 <ChevronRight size={13} /></Link>
              </div>
            ) : null}
          </div>
        </header>
        <main className="page-content">{children}</main>
      </section>
    </div>
  );
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <header className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
      {action ? <div className="page-heading-action">{action}</div> : null}
    </header>
  );
}

export function ProgressLine({ value, compact = false }: { value: number; compact?: boolean }) {
  return <div className={`progress-track ${compact ? "compact" : ""}`}><span style={{ width: `${value}%` }} /></div>;
}
