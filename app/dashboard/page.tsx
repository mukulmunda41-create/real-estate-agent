"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import AIOrchestratorHub from "@/components/AIOrchestratorHub";
import VoiceWaveform from "@/components/VoiceWaveform";
import { Sparkline, Donut, Funnel, Heatmap, Gauge } from "@/components/charts";
import { useRealtime } from "@/lib/use-realtime";
import { useStats } from "@/lib/use-stats";
import { getBrowserClient } from "@/lib/supabase-browser";
import { clockTime as time, timeAgo } from "@/lib/format";

// follow the cursor for the pointer-tracked glow microinteraction
function trackGlow(e: React.MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

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

// pick an icon glyph + accent color for an activity-feed row from its label
function feedStyle(label: string | null, agent: string | null): { icon: string; color: string } {
  const t = (label || "").toLowerCase();
  if (t.includes("voice") && t.includes("repl")) return { icon: "🔊", color: "#f59e0b" };
  if (t.includes("voice") || t.includes("transcri") || t.includes("audio")) return { icon: "🎙️", color: "#22d3ee" };
  if (t.includes("repl") || t.includes("sent")) return { icon: "✈️", color: "#34d399" };
  if (t.includes("book")) return { icon: "📅", color: "#34d399" };
  if (t.includes("concierge") || t.includes("faq") || t.includes("rout")) return { icon: "💬", color: "#38bdf8" };
  if (t.includes("lead") || t.includes("updat")) return { icon: "👤", color: "#a78bfa" };
  if (t.includes("image") || t.includes("photo")) return { icon: "🖼️", color: "#ec4899" };
  if (agent) return { icon: "🤖", color: "#60a5fa" };
  return { icon: "🚩", color: "#a78bfa" };
}

function Kpi({ label, value, delta, spark, color, icon }: { label: string; value: string; delta?: number; spark: number[]; color: string; icon: string }) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="hud sheen glow-track rounded-2xl p-4" onMouseMove={trackGlow} style={{ ["--glow" as string]: color }}>
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl text-base" style={{ background: `${color}22`, color, boxShadow: `0 0 18px -6px ${color}` }}>{icon}</span>
        {delta !== undefined && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${up ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
            {up ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-3 text-[26px] font-bold leading-none text-slate-100">{value}</div>
      <div className="mt-1.5 flex items-end justify-between">
        <div>
          <div className="text-xs font-medium text-slate-300">{label}</div>
          <div className="text-[10px] text-slate-500">vs last 7 days</div>
        </div>
        <Sparkline values={spark} color={color} w={84} h={30} />
      </div>
    </div>
  );
}

function Panel({ title, children, className = "", action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={`hud sheen glow-track rounded-2xl p-4 ${className}`} onMouseMove={trackGlow}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const events = useRealtime<AgentEvent>("agent_events", { limit: 80 });
  const messages = useRealtime<Message>("messages", { limit: 80 });
  const stats = useStats(events.length);
  const [properties, setProperties] = useState<Property[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBrowserClient()
      .from("properties")
      .select("id,name,property_type,location,city,bhk_config,price,image_urls")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => data && setProperties(data as Property[]));
  }, []);

  // A wheel/trackpad gesture anywhere over the Live Conversation panel scrolls
  // the messages box — and never bleeds into the page scroll. Captured on the
  // whole panel (header, composer, bubbles) so the page can't move from here.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onWheel = (e: WheelEvent) => {
      const sc = chatRef.current;
      if (!sc || sc.scrollHeight <= sc.clientHeight) return; // nothing to scroll → let page move
      e.preventDefault(); // we own this gesture
      sc.scrollTop += e.deltaY;
    };
    panel.addEventListener("wheel", onWheel, { passive: false });
    return () => panel.removeEventListener("wheel", onWheel);
  }, []);

  // Keep the chat pinned to the newest message as it streams in.
  useEffect(() => {
    const sc = chatRef.current;
    if (sc) sc.scrollTop = sc.scrollHeight;
  }, [messages.length]);

  const k = stats?.kpis;
  const kpis = [
    { label: "Total Leads", value: String(k?.totalLeads ?? 0), delta: stats?.deltas.leads, spark: stats?.spark.leads ?? [], color: "#a78bfa", icon: "👥" },
    { label: "Active Conversations", value: String(k?.activeConversations ?? 0), delta: stats?.deltas.messages, spark: stats?.spark.messages ?? [], color: "#22d3ee", icon: "💬" },
    { label: "Site Visits Booked", value: String(k?.siteVisits ?? 0), delta: stats?.deltas.visits, spark: stats?.spark.visits ?? [], color: "#34d399", icon: "📅" },
    { label: "Conversion Rate", value: `${k?.conversion ?? 0}%`, spark: stats?.spark.visits ?? [], color: "#f59e0b", icon: "📈" },
    { label: "Revenue Pipeline", value: money(k?.pipeline ?? 0), spark: stats?.spark.leads ?? [], color: "#ec4899", icon: "💰" },
  ];

  const latestPhone = messages[0]?.phone;
  const thread = messages.filter((m) => m.phone === latestPhone).slice(0, 14).reverse();
  const latestIsVoice = thread.length > 0 && thread[thread.length - 1].msg_type !== "text";
  const agentTyping = thread.length > 0 && thread[thread.length - 1].role === "user";
  const donutData = (stats?.leadMix ?? []).map((d, i) => ({ label: pretty(d.label), value: d.count, color: PALETTE[i % PALETTE.length] }));
  const leadTotal = donutData.reduce((a, d) => a + d.value, 0) || 1;

  // AI smart insights derived from live data
  const insights = useMemo(() => {
    const out: { icon: string; color: string; title: string; sub: string }[] = [];
    if (stats) {
      const hot = stats.funnel[1]?.count ?? 0;
      out.push({ icon: "🔥", color: "#ec4899", title: "High-intent leads", sub: `${hot} qualified — prioritise follow-up` });
      // peak conversion hour from heat matrix (sum across days per 2h bucket)
      const cols = (stats.heat[0] ?? []).map((_, j) => stats.heat.reduce((s, row) => s + (row[j] || 0), 0));
      const peak = cols.length ? cols.indexOf(Math.max(...cols)) : -1;
      if (peak >= 0) {
        const h = peak * 2;
        const fmtH = (x: number) => `${((x % 12) || 12)}${x < 12 ? "AM" : "PM"}`;
        out.push({ icon: "⏰", color: "#38bdf8", title: "Peak activity window", sub: `${fmtH(h)}–${fmtH((h + 2) % 24)} IST` });
      }
      out.push({ icon: "💹", color: "#34d399", title: "Pipeline value", sub: `${money(stats.kpis.pipeline)} in play` });
    }
    // top agent by runs today
    const counts: Record<string, number> = {};
    for (const e of events) if (e.agent && e.event_type === "llm") counts[e.agent] = (counts[e.agent] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top) out.push({ icon: "🏆", color: "#a78bfa", title: "Top agent today", sub: `${pretty(top[0])} · ${top[1]} runs` });
    return out;
  }, [stats, events]);

  return (
    <DashboardShell title="Dashboard">
      {/* KPI row */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kp) => <Kpi key={kp.label} {...kp} />)}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        {/* LEFT */}
        <div className="space-y-5">
          <AIOrchestratorHub events={events} />

          {/* Analytics row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Panel title="AI Performance Score" className="flex flex-col">
              <div className="flex flex-1 flex-col items-center">
                <div className="relative">
                  <Gauge value={stats?.aiPerformance.conversion ?? 0} size={132} color="#34d399" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[28px] font-bold leading-none text-emerald-300">{stats?.aiPerformance.conversion ?? 0}%</span>
                    <span className="mt-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-300">Score</span>
                  </div>
                </div>
                <div className="mt-4 w-full space-y-2 text-[11px]">
                  {[
                    { l: "Qualified rate", v: `${stats?.aiPerformance.qualifiedRate ?? 0}%` },
                    { l: "Bookings", v: stats?.aiPerformance.bookings ?? 0 },
                    { l: "Messages handled", v: stats?.aiPerformance.messagesHandled ?? 0 },
                  ].map((r) => (
                    <div key={r.l} className="flex items-center justify-between border-b border-white/5 pb-1.5 last:border-0">
                      <span className="text-slate-400">{r.l}</span>
                      <span className="font-semibold text-slate-100">{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Activity Heatmap (7 days)" className="flex flex-col">
              <Heatmap matrix={stats?.heat ?? Array.from({ length: 7 }, () => Array(12).fill(0))} max={stats?.heatMax ?? 1} />
              <div className="mt-2 flex justify-between text-[9px] text-slate-500"><span>12am</span><span>12pm</span><span>11pm</span></div>
              <div className="mt-auto flex items-center justify-end gap-2 pt-3 text-[9px] text-slate-500">
                <span>Low</span>
                <span className="h-2 w-20 rounded-full" style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.12), rgba(139,92,246,1))" }} />
                <span>High</span>
              </div>
            </Panel>

            <Panel title="Conversion Funnel" className="flex flex-col">
              <div className="flex-1">
                <Funnel steps={stats?.funnel ?? []} color="#a78bfa" />
              </div>
            </Panel>

            <Panel title="Lead Mix" className="flex flex-col overflow-hidden">
              <div className="flex flex-1 flex-col items-center">
                <div className="relative">
                  <Donut data={donutData.length ? donutData : [{ label: "—", value: 1, color: "#334155" }]} size={116} thickness={13} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-slate-100">{k?.totalLeads ?? 0}</span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">total leads</span>
                  </div>
                </div>
                <div className="mt-3.5 w-full space-y-2.5">
                  {donutData.slice(0, 4).map((d) => {
                    const pct = Math.round((d.value / leadTotal) * 100);
                    return (
                      <div key={d.label}>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color, boxShadow: `0 0 8px -1px ${d.color}` }} />
                            <span className="truncate text-slate-300">{d.label}</span>
                          </span>
                          <span className="shrink-0 font-medium text-slate-200">{pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                          <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${d.color}88, ${d.color})`, boxShadow: `0 0 10px -3px ${d.color}` }} />
                        </div>
                      </div>
                    );
                  })}
                  {donutData.length === 0 && <span className="text-[11px] text-slate-500">No leads yet</span>}
                </div>
              </div>
            </Panel>
          </div>

          {/* Top properties */}
          <Panel title="Top Properties" action={<a href="/properties" className="text-[11px] text-violet-300 hover:text-violet-200">View all →</a>}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {properties.map((p) => (
                <div key={p.id} className="lift group overflow-hidden rounded-xl border border-white/8 bg-white/5">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image_urls?.[0] ? <img src={p.image_urls[0]} alt={p.name} className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-violet-500/20 to-sky-500/10 text-2xl">🏠</div>}
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent" />
                    {p.property_type && <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-sky-200 backdrop-blur">{p.property_type}</span>}
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-[11px] text-pink-300 backdrop-blur">♥</span>
                  </div>
                  <div className="p-2.5">
                    <div className="truncate text-xs font-semibold text-slate-100">{p.name}</div>
                    <div className="truncate text-[11px] text-slate-400">{p.location || p.city}</div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">{p.bhk_config}</span>
                      <span className="font-semibold text-violet-300">{p.price}{p.price ? " onwards" : ""}</span>
                    </div>
                  </div>
                </div>
              ))}
              {properties.length === 0 && <span className="text-xs text-slate-500">No properties yet.</span>}
            </div>
          </Panel>
        </div>

        {/* RIGHT RAIL */}
        <div className="space-y-5">
          {/* Live conversation — fixed-height flex column; only the messages
              area scrolls, composer stays pinned, page never moves */}
          <div ref={panelRef} className="hud hud-edge sheen flex h-[68vh] max-h-[640px] min-h-[460px] flex-col overflow-hidden rounded-2xl p-4">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live Conversation</h3>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 neon-pulse" style={{ color: "#34d399" }} /> Live
              </span>
            </div>
            {latestPhone ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex shrink-0 items-center gap-2.5 border-b border-white/10 pb-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-sm">
                    <svg viewBox="0 0 24 24" fill="#25D366" className="h-5 w-5"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.8.7.8-2.7-.2-.3A8 8 0 1 1 12 20zm4.5-5.9c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.6 4 5.3 5.3 0 0 0 3.2.7 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z" /></svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-100">{latestPhone}</div>
                    <div className="text-[10px] text-emerald-300">● Active on WhatsApp</div>
                  </div>
                </div>

                {/* scrollable messages — the ONLY scroll region here */}
                <div
                  ref={chatRef}
                  className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
                  style={{ overscrollBehavior: "contain", scrollBehavior: "smooth" }}
                >
                  {thread.map((m, i) => {
                    const isUser = m.role === "user";
                    const newest = i === thread.length - 1;
                    return (
                      <div key={m.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                        <div className={`${newest ? "msg-in" : ""} max-w-[82%] rounded-2xl px-3 py-2 text-xs ${isUser ? "rounded-tl-sm bg-white/8 text-slate-200" : "rounded-tr-sm bg-gradient-to-br from-violet-500/45 to-sky-500/30 text-white"}`}>
                          {m.content || m.transcript}
                          <div className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-60">
                            {m.msg_type !== "text" && <span>{m.msg_type}</span>}
                            <span>{time(m.created_at)}</span>
                            {!isUser && <span className="text-sky-200">✓✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {agentTyping && (
                    <div className="flex justify-end">
                      <div className="typing rounded-2xl rounded-tr-sm bg-gradient-to-br from-violet-500/30 to-sky-500/20 px-3 py-2.5 text-white">
                        <i /><i /><i />
                      </div>
                    </div>
                  )}
                </div>

                {latestIsVoice && <div className="mt-3 shrink-0"><VoiceWaveform /></div>}

                {/* pinned composer (monitor-only) */}
                <div className="mt-3 flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 opacity-70" title="Monitor view — replies are sent by the AI agent">
                  <input disabled placeholder="Type a message…" className="flex-1 bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-500" />
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-white">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="m22 2-7 20-4-9-9-4z" /></svg>
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-500">No conversations yet.</div>
            )}
          </div>

          {/* Live activity feed */}
          <Panel title="Live Activity Feed" action={<span className="blink text-[10px] text-sky-300">● streaming</span>}>
            <div className="space-y-1.5">
              {events.slice(0, 11).map((e) => {
                const s = feedStyle(e.label, e.agent);
                return (
                  <div key={e.id} className="row-in flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px]" style={{ background: `${s.color}1f` }}>{s.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-slate-200">{e.label || pretty(e.event_type)}</div>
                      {e.agent && <div className="text-[10px] text-slate-500">@{e.agent}</div>}
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(e.created_at)}</span>
                  </div>
                );
              })}
              {events.length === 0 && <span className="text-xs text-slate-500">No activity yet.</span>}
            </div>
          </Panel>

          {/* AI smart insights */}
          <Panel title="AI Smart Insights">
            <div className="grid grid-cols-1 gap-2">
              {insights.map((ins, i) => (
                <div key={i} className="lift flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm" style={{ background: `${ins.color}1f`, boxShadow: `0 0 14px -6px ${ins.color}` }}>{ins.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-slate-100">{ins.title}</div>
                    <div className="truncate text-[11px] text-slate-400">{ins.sub}</div>
                  </div>
                </div>
              ))}
              {insights.length === 0 && <span className="text-xs text-slate-500">Gathering signal…</span>}
            </div>
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}
