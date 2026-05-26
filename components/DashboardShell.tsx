"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase-browser";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d={d} />
    </svg>
  );
}

const NAV = [
  { href: "/dashboard", label: "Live Agent", icon: "M4 5h16M4 12h10M4 19h7" },
  { href: "/leads", label: "Leads", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" },
  { href: "/visits", label: "Site Visits", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
  { href: "/properties", label: "Properties", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" },
];

export default function DashboardShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [clock, setClock] = useState("");

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
    const t = setInterval(
      () => setClock(new Date().toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" })),
      1000
    );
    return () => clearInterval(t);
  }, []);

  if (!ready) return <div className="app-shell flex items-center justify-center text-emerald-400">Initializing…</div>;
  if (!session) return null;

  const current = NAV.find((n) => n.href === pathname);

  return (
    <div className="app-shell text-slate-200">
      {/* Sidebar */}
      <aside className="glass fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-white/10">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 text-lg glow-violet">🏙️</div>
          <div>
            <div className="text-sm font-bold gradient-text">Real Estate Agent</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">AI Assistant</div>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                pathname === n.href ? "nav-active font-medium" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon d={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 truncate px-2 text-[11px] text-slate-500">{session.user.email}</div>
          <button
            onClick={async () => {
              await getBrowserClient().auth.signOut();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-60">
        <header className="glass sticky top-0 z-10 flex items-center justify-between border-b border-white/10 px-6 py-3.5">
          <h1 className="text-lg font-semibold text-slate-100">{title || current?.label || "Dashboard"}</h1>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 neon-pulse" style={{ color: "#34d399" }} />
              System live
            </span>
            <span className="font-mono text-emerald-300">{clock} IST</span>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
