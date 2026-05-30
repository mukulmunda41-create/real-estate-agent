"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import AgentPipeline from "@/components/AgentPipeline";
import { Sparkline, Donut, Funnel, Heatmap, Gauge } from "@/components/charts";
import { useRealtime } from "@/lib/use-realtime";
import { useStats } from "@/lib/use-stats";
import { getBrowserClient } from "@/lib/supabase-browser";
import { clockTime as time } from "@/lib/format";

type AgentEvent = { id: string; event_type: string; agent: string | null; label: string | null; phone: string | null; created_at: string };
type Message = { id: string; phone: string; role: string; msg_type: string; content: string | null; transcript: string | null; created_at: string };
type Property = { id: string; name: string; property_type: string | null; location: string | null; city: string | null; bhk_config: string | null; price: string | null; image_urls: string[] | null };

const PALETTE = ["#a78bfa", "#22d3ee", "#34d399", "#f59e0b", "#ec4899", "#60a5fa"];

function money(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}
const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function Kpi({ label, value, delta, spark, color, icon }: { label: string; value: string; delta?: number; spark: number[]; color: string; icon: string }) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg text-base" style={{ background: `${color}22` }}>{icon}</span>
        {delta !== undefined && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${up ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
            {up ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-100">{value}</div>
      <div className="mt-1 flex items-end justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <Sparkline values={spark} color={color} w={84} h={28} />
      </div>
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-2xl p-4 ${className}`}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const events = useRealtime<AgentEvent>("agent_events", { limit: 80 });
  const messages = useRealtime<Message>("messages", { limit: 80 });
  const stats = useStats(events.length);
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    getBrowserClient()
      .from("properties")
      .select("id,name,property_type,location,city,bhk_config,price,image_urls")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => data && setProperties(data as Property[]));
  }, []);

  const k = stats?.kpis;
  const kpis = [
    { label: "Total Leads", value: String(k?.totalLeads ?? 0), delta: stats?.deltas.leads, spark: stats?.spark.leads ?? [], color: "#a78bfa", icon: "👥" },
    { label: "Active Conversations", value: String(k?.activeConversations ?? 0), spark: stats?.spark.messages ?? [], color: "#22d3ee", icon: "💬" },
    { label: "Site Visits Booked", value: String(k?.siteVisits ?? 0), delta: stats?.deltas.visits, spark: stats?.spark.visits ?? [], color: "#34d399", icon: "📅" },
    { label: "Conversion Rate", value: `${k?.conversion ?? 0}%`, spark: stats?.spark.visits ?? [], color: "#f59e0b", icon: "📈" },
    { label: "Revenue Pipeline", value: money(k?.pipeline ?? 0), spark: stats?.spark.leads ?? [], color: "#ec4899", icon: "💰" },
  ];

  const latestPhone = messages[0]?.phone;
  const thread = messages.filter((m) => m.phone === latestPhone).slice(0, 14).reverse();
  const donutData = (stats?.leadMix ?? []).map((d, i) => ({ label: pretty(d.label), value: d.count, color: PALETTE[i % PALETTE.length] }));

  return (
    <DashboardShell title="Dashboard">
      {/* KPI row */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kp) => <Kpi key={kp.label} {...kp} />)}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        {/* LEFT */}
        <div className="space-y-5">
          <AgentPipeline events={events} />

          {/* Analytics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Panel title="Lead Mix">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Donut data={donutData.length ? donutData : [{ label: "—", value: 1, color: "#334155" }]} size={130} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-slate-100">{k?.totalLeads ?? 0}</span>
                    <span className="text-[10px] text-slate-400">leads</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {donutData.map((d) => (
                    <div key={d.label} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                      <span className="flex-1 text-slate-300">{d.label}</span>
                      <span className="text-slate-400">{d.value}</span>
                    </div>
                  ))}
                  {donutData.length === 0 && <span className="text-xs text-slate-500">No leads yet</span>}
                </div>
              </div>
            </Panel>

            <Panel title="Conversion Funnel">
              <Funnel steps={stats?.funnel ?? []} color="#a78bfa" />
            </Panel>

            <Panel title="Activity Heatmap (7 days)">
              <Heatmap matrix={stats?.heat ?? Array.from({ length: 7 }, () => Array(12).fill(0))} max={stats?.heatMax ?? 1} />
              <div className="mt-2 flex justify-between text-[9px] text-slate-500"><span>12am</span><span>12pm</span><span>11pm</span></div>
            </Panel>

            <Panel title="AI Performance">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Gauge value={stats?.aiPerformance.conversion ?? 0} size={120} color="#34d399" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-emerald-300">{stats?.aiPerformance.conversion ?? 0}%</span>
                    <span className="text-[10px] text-slate-400">conversion</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Qualified rate</span><span className="text-slate-100">{stats?.aiPerformance.qualifiedRate ?? 0}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Bookings</span><span className="text-slate-100">{stats?.aiPerformance.bookings ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Messages handled</span><span className="text-slate-100">{stats?.aiPerformance.messagesHandled ?? 0}</span></div>
                </div>
              </div>
            </Panel>
          </div>

          {/* Top properties */}
          <Panel title="Top Properties">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {properties.map((p) => (
                <div key={p.id} className="overflow-hidden rounded-xl bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image_urls?.[0] ? <img src={p.image_urls[0]} alt={p.name} className="h-24 w-full object-cover" /> : <div className="flex h-24 w-full items-center justify-center bg-gradient-to-br from-violet-500/20 to-blue-500/10 text-2xl">🏠</div>}
                  <div className="p-2">
                    <div className="truncate text-xs font-semibold text-slate-100">{p.name}</div>
                    <div className="truncate text-[11px] text-slate-400">{p.location || p.city}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{p.bhk_config}</span>
                      <span className="font-medium text-violet-300">{p.price}</span>
                    </div>
                  </div>
                </div>
              ))}
              {properties.length === 0 && <span className="text-xs text-slate-500">No properties yet.</span>}
            </div>
          </Panel>
        </div>

        {/* RIGHT */}
        <div className="space-y-5">
          {/* Live conversation */}
          <Panel title="Live Conversation" className="flex flex-col">
            {latestPhone ? (
              <>
                <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20 text-sm">🧑</span>
                  <div>
                    <div className="text-sm font-medium text-slate-100">{latestPhone}</div>
                    <div className="text-[10px] text-emerald-300">● active on WhatsApp</div>
                  </div>
                </div>
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {thread.map((m) => {
                    const isUser = m.role === "user";
                    return (
                      <div key={m.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${isUser ? "rounded-tl-sm bg-white/8 text-slate-200" : "rounded-tr-sm bg-gradient-to-br from-violet-500/40 to-blue-500/30 text-white"}`}>
                          {m.content || m.transcript}
                          <div className="mt-1 text-[9px] opacity-50">{time(m.created_at)}{m.msg_type !== "text" ? ` · ${m.msg_type}` : ""}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">No conversations yet.</p>
            )}
          </Panel>

          {/* Recent activity */}
          <Panel title="Recent Activity">
            <div className="space-y-2">
              {events.slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-slate-200">{e.label}</div>
                    <div className="text-[10px] text-slate-500">{e.agent ? `@${e.agent} · ` : ""}{time(e.created_at)}</div>
                  </div>
                </div>
              ))}
              {events.length === 0 && <span className="text-xs text-slate-500">No activity yet.</span>}
            </div>
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}
