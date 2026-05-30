"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase-browser";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      {d.split("|").map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

// IST wall clock, e.g. "30 May 2026, 8:45:12 PM"
function fmtClock() {
  return new Date()
    .toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit", second: "2-digit",
      hour12: true, timeZone: "Asia/Kolkata",
    })
    .replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
}

type NavItem = { href: string; label: string; icon: string };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" },
  { href: "/conversations", label: "Conversations", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { href: "/leads", label: "Leads", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M22 21v-2a4 4 0 0 0-3-3.87|M16 3.13A4 4 0 0 1 16 11" },
  { href: "/visits", label: "Site Visits", icon: "M8 2v4|M16 2v4|M3 10h18|M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
  { href: "/properties", label: "Properties", icon: "M3 21h18|M5 21V7l7-4 7 4v14|M9 21v-6h6v6" },
  { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" },
];

export default function DashboardShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [clock, setClock] = useState(fmtClock);

  useEffect(() => {
    const sb = getBrowserClient();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
      if (!data.session) router.replace("/login");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    const t = setInterval(() => setClock(fmtClock()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!ready) return <div className="command-shell flex items-center justify-center text-sky-300">Initializing command center…</div>;
  if (!session) return null;

  const current = NAV.find((n) => n.href === pathname);
  const email = session.user.email ?? "admin";
  const initial = (email[0] || "A").toUpperCase();

  return (
    <div className="command-shell text-slate-200">
      <div className="neural-grid" />
      <div className="fog-layer" />

      {/* Sidebar */}
      <aside className="hud fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/10">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-sky-500/20 text-lg glow-violet">
            <span className="absolute inset-0 rounded-xl breathe" style={{ boxShadow: "0 0 22px -4px rgba(139,92,246,0.9)" }} />
            <span className="relative text-aurora font-black">◈</span>
          </div>
          <div>
            <div className="text-[13px] font-extrabold tracking-wide text-slate-100">REAL ESTATE AI</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">AI Command Center</div>
          </div>
        </div>

        <nav className="mt-1 flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((n) => {
            const active = pathname === n.href;
            const cls = `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ${
              active ? "nav-active font-semibold" : "text-slate-400 hover:translate-x-0.5 hover:bg-white/5 hover:text-slate-100"
            }`;
            const inner = (
              <>
                <span className={`transition-transform duration-300 group-hover:scale-110 ${active ? "text-violet-300 drop-shadow-[0_0_8px_rgba(167,139,250,0.8)]" : "text-slate-500 group-hover:text-slate-200"}`}>
                  <Icon d={n.icon} />
                </span>
                <span className="flex-1">{n.label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-violet-400 neon-pulse" style={{ color: "#a78bfa" }} />}
              </>
            );
            return <Link key={n.href} href={n.href} className={cls}>{inner}</Link>;
          })}
        </nav>

        {/* user card */}
        <div className="px-3 pb-2">
          <div className="hud flex items-center gap-3 rounded-2xl p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-sm font-bold text-white">{initial}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-slate-100">{email.split("@")[0]}</div>
              <div className="truncate text-[10px] text-slate-500">{email}</div>
            </div>
          </div>
        </div>

        {/* sign out */}
        <div className="border-t border-white/10 px-4 py-3">
          <button
            onClick={async () => {
              await getBrowserClient().auth.signOut();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="relative z-10 ml-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-3.5 backdrop-blur-xl">
          <div>
            <h1 className="text-xl font-bold text-slate-100">{title || current?.label || "Dashboard"}</h1>
            <p className="text-[11px] text-slate-500">AI Performance Overview</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 neon-pulse" style={{ color: "#34d399" }} />
              System Live
            </span>
            <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-slate-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5 text-slate-500"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
              {clock}
            </span>
            <button className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition-colors hover:text-white" aria-label="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-pink-500 neon-pulse" style={{ color: "#ec4899" }} />
            </button>
            <button className="hidden h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition-colors hover:text-white md:flex" aria-label="Fullscreen" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
            </button>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
