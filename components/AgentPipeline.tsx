"use client";

import { useEffect, useState } from "react";
import RobotAvatar from "@/components/RobotAvatar";
import { getBrowserClient } from "@/lib/supabase-browser";

export type AgentEvent = {
  id: string;
  event_type: string;
  agent: string | null;
  created_at: string;
};

type AgentMeta = { key: string; n: string; label: string; color: string; proactive?: "followup" | "reactivation" };

const AGENTS: AgentMeta[] = [
  { key: "lead_qualification", n: "Agent 1", label: "Lead Qualification", color: "#22d3ee" },
  { key: "property_recommendation", n: "Agent 2", label: "Property Recommendation", color: "#a78bfa" },
  { key: "site_visit_booking", n: "Agent 3", label: "Site Visit Booking", color: "#34d399" },
  { key: "concierge", n: "Agent 4", label: "Concierge / FAQ", color: "#38bdf8" },
  { key: "follow_up", n: "Agent 5", label: "Follow-up Agent", color: "#f59e0b", proactive: "followup" },
  { key: "reactivation", n: "Agent 6", label: "Reactivation Agent", color: "#ec4899", proactive: "reactivation" },
];

function todayCount(events: AgentEvent[], key: string, startOfDay: number) {
  return events.filter(
    (e) => e.agent === key && e.event_type === "llm" && new Date(e.created_at).getTime() >= startOfDay
  ).length;
}

export default function AgentPipeline({ events }: { events: AgentEvent[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);

  async function sweep(job: "followup" | "reactivation") {
    setBusy(job);
    setMsg("");
    const { data } = await getBrowserClient().auth.getSession();
    const res = await fetch(`/api/cron/${job}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    setMsg(res.ok ? `${job}: ${j.processed ?? 0} processed` : `Error: ${j.error || res.status}`);
  }

  return (
    <section className="glass rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">AI Agents — Live & Active</h2>
        <span className="flex items-center gap-2 text-xs text-emerald-300">
          {msg && <span className="text-violet-300">{msg}</span>}
          <span className="h-2 w-2 rounded-full bg-emerald-400 neon-pulse" style={{ color: "#34d399" }} />
          All agents online
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {AGENTS.map((a) => {
          const recent = events.find((e) => e.agent === a.key);
          const active = !!recent && now - new Date(recent.created_at).getTime() < 12000;
          const runs = todayCount(events, a.key, startOfDay);
          const fill = active ? 100 : Math.min(90, 20 + runs * 12);
          return (
            <div
              key={a.key}
              className={`rounded-xl p-3 transition-all ${active ? "card-violet" : "glass-soft"}`}
              style={active ? { borderColor: a.color, boxShadow: `0 0 20px ${a.color}44` } : {}}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{a.n}</span>
                <span
                  className={`h-2 w-2 rounded-full ${active ? "" : "opacity-30"}`}
                  style={{ background: a.color, boxShadow: active ? `0 0 8px ${a.color}` : "none" }}
                />
              </div>
              <div className="flex justify-center py-1">
                <RobotAvatar color={a.color} active={active} compact />
              </div>
              <div className="mt-2 text-center text-xs font-semibold text-slate-100">{a.label}</div>
              <div className="mt-0.5 text-center text-[11px]" style={{ color: a.color }}>
                {active ? "● working" : "idle"}
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-1.5 rounded-full ${active ? "neon-pulse" : ""}`}
                  style={{ width: `${fill}%`, background: a.color, color: a.color }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                <span>{runs} today</span>
                {a.proactive && (
                  <button
                    onClick={() => sweep(a.proactive!)}
                    disabled={busy !== null}
                    className="rounded border border-white/10 px-1.5 py-0.5 transition-colors hover:border-violet-400/60 hover:text-violet-300 disabled:opacity-50"
                  >
                    {busy === a.proactive ? "…" : "▶ run"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
