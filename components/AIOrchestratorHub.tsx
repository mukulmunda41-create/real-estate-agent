"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import HoloBrain from "@/components/HoloBrain";
import ParticleField from "@/components/ParticleField";
import { getBrowserClient } from "@/lib/supabase-browser";
import { timeAgo } from "@/lib/format";

export type AgentEvent = {
  id: string;
  event_type: string;
  agent: string | null;
  created_at: string;
};

type AgentMeta = {
  key: string;
  label: string;
  color: string;
  icon: string;
  side: "left" | "right";
  proactive?: "followup" | "reactivation";
  unit: string; // noun for the count line
  op: { live: string; queue: string; idle: string }; // operational status phrasing
};

const AGENTS: AgentMeta[] = [
  { key: "lead_qualification", label: "Lead Qualification Agent", color: "#22d3ee", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", side: "left", unit: "leads processing", op: { live: "Analyzing inquiry", queue: "Lead in queue", idle: "Qualification ready" } },
  { key: "property_recommendation", label: "Property Recommendation", color: "#a78bfa", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6", side: "left", unit: "matches found", op: { live: "Matching properties", queue: "Match queued", idle: "Match engine ready" } },
  { key: "site_visit_booking", label: "Site Visit Booking Agent", color: "#34d399", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", side: "left", unit: "bookings in progress", op: { live: "Scheduling visit", queue: "Slot pending", idle: "Calendar synced" } },
  { key: "concierge", label: "Concierge / FAQ Agent", color: "#38bdf8", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", side: "right", unit: "conversations", op: { live: "Generating response", queue: "Reply queued", idle: "Standing by" } },
  { key: "follow_up", label: "Follow-up Agent", color: "#f59e0b", icon: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z", side: "right", proactive: "followup", unit: "follow-ups running", op: { live: "Preparing follow-up", queue: "Syncing CRM", idle: "Follow-ups ready" } },
  { key: "reactivation", label: "Reactivation Agent", color: "#ec4899", icon: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15", side: "right", proactive: "reactivation", unit: "campaigns scheduled", op: { live: "Queuing campaign", queue: "Campaign queued", idle: "Reactivation armed" } },
];

// little inline equalizer shown while an agent is working
function Equalizer({ color }: { color: string }) {
  return (
    <span className="inline-flex h-3 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="eq-bar w-[2px] rounded-full" style={{ height: "100%", background: color, animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

type AgentState = "active" | "processing" | "waiting" | "idle";

function deriveState(events: AgentEvent[], a: AgentMeta, now: number): { state: AgentState; runs: number; lastTs: string | null } {
  const recent = events.find((e) => e.agent === a.key && e.event_type === "llm");
  const sinceMs = recent ? now - new Date(recent.created_at).getTime() : Infinity;
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const runs = events.filter((e) => e.agent === a.key && e.event_type === "llm" && new Date(e.created_at).getTime() >= startOfDay).length;
  let state: AgentState;
  if (sinceMs < 12000) state = "active";
  else if (sinceMs < 120000) state = "processing";
  else if (a.proactive) state = "waiting";
  else state = "idle";
  return { state, runs, lastTs: recent?.created_at ?? null };
}

// follow the cursor for the pointer-tracked glow microinteraction
function trackGlow(e: React.MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

type Line = { id: string; d: string; color: string; active: boolean };

export default function AIOrchestratorHub({ events }: { events: AgentEvent[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [sweepMsg, setSweepMsg] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);

  const states = AGENTS.map((a) => ({ a, ...deriveState(events, a, now) }));
  const totalProcessing = states.filter((s) => s.state === "active" || s.state === "processing").length;
  const totalRuns = states.reduce((sum, s) => sum + s.runs, 0);

  // Measure positions and build curved connector paths from the core to each node.
  useLayoutEffect(() => {
    const compute = () => {
      const wrap = wrapRef.current;
      const core = coreRef.current;
      if (!wrap || !core) return;
      const W = wrap.getBoundingClientRect();
      const C = core.getBoundingClientRect();
      const cx = C.left + C.width / 2 - W.left;
      const cy = C.top + C.height / 2 - W.top;
      const out: Line[] = [];
      for (const { a, state } of states) {
        const el = nodeRefs.current[a.key];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const nx = a.side === "left" ? r.right - W.left : r.left - W.left;
        const ny = r.top + r.height / 2 - W.top;
        const midx = (cx + nx) / 2;
        // gentle S-curve toward the node
        const d = `M ${cx} ${cy} C ${midx} ${cy}, ${midx} ${ny}, ${nx} ${ny}`;
        out.push({ id: a.key, d, color: a.color, active: state === "active" || state === "processing" });
      }
      setLines(out);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
    // re-measure when state labels change (active toggles affect line styling)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length, now]);

  async function sweep(job: "followup" | "reactivation") {
    setBusy(job);
    setSweepMsg("");
    const { data } = await getBrowserClient().auth.getSession();
    const res = await fetch(`/api/cron/${job}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    setSweepMsg(res.ok ? `${job}: ${j.processed ?? 0} processed` : `Error: ${j.error || res.status}`);
  }

  const left = states.filter((s) => s.a.side === "left");
  const right = states.filter((s) => s.a.side === "right");

  const renderNode = ({ a, state, runs, lastTs }: { a: AgentMeta; state: AgentState; runs: number; lastTs: string | null }) => {
    const live = state === "active" || state === "processing";
    const count = a.key === "lead_qualification" || a.key === "concierge" ? runs : Math.max(runs, state === "waiting" ? 2 : 0);
    const status = live ? a.op.live : state === "waiting" ? a.op.queue : a.op.idle;
    // believable live queue depth from recent activity for this agent
    const queue = events.filter((e) => e.agent === a.key && e.event_type === "llm" && now - new Date(e.created_at).getTime() < 300000).length;
    const seen = lastTs ? timeAgo(lastTs) : null;
    return (
      <div
        key={a.key}
        ref={(el) => { nodeRefs.current[a.key] = el; }}
        onMouseMove={trackGlow}
        className={`hud sheen glow-track group relative rounded-2xl p-3.5 ${live ? "node-active" : ""}`}
        style={{ ["--glow" as string]: a.color, borderColor: live ? `${a.color}55` : undefined }}
      >
        <div className="flex items-start gap-3">
          <span
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${live ? "breathe" : ""}`}
            style={{
              background: `linear-gradient(150deg, ${a.color}40, ${a.color}0d 70%)`,
              border: `1px solid ${a.color}66`,
              color: a.color,
              boxShadow: live
                ? `0 0 22px -4px ${a.color}, inset 0 1px 0 ${a.color}55`
                : `inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
          >
            {/* glossy top-light highlight */}
            <span className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 30% 22%, rgba(255,255,255,0.28), transparent 58%)" }} />
            <Icon d={a.icon} className="relative h-5 w-5 drop-shadow-[0_0_6px_currentColor]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold leading-tight text-slate-100">{a.label}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: a.color }}>
              {live ? (
                <Equalizer color={a.color} />
              ) : (
                <span className="ping-dot inline-block h-2 w-2 rounded-full" style={{ ["--glow" as string]: a.color, background: a.color, animationPlayState: "paused" }} />
              )}
              <span className="truncate">{status}{live ? "…" : ""}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>{count} {a.unit}</span>
              {live && queue > 0 && <span className="rounded bg-white/8 px-1 text-[9px] text-slate-300">{queue} queued</span>}
              {!live && seen && <span className="text-[10px] text-slate-500">· {seen}</span>}
            </div>
          </div>
          {a.proactive && (
            <button
              onClick={() => sweep(a.proactive!)}
              disabled={busy !== null}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[10px] text-slate-400 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
              title="Run sweep now"
            >
              {busy === a.proactive ? "…" : "▶"}
            </button>
          )}
        </div>
        {live && (
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div className="bar-load h-1 rounded-full" style={{ background: `${a.color}55`, color: a.color }} />
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="hud hud-edge sheen depth breathe relative overflow-hidden rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-aurora">AI Orchestration Hub</h2>
          <p className="text-[11px] text-slate-400">Real-time multi-agent collaboration</p>
        </div>
        {sweepMsg && <span className="text-[11px] text-violet-300">{sweepMsg}</span>}
      </div>

      <div ref={wrapRef} className="relative grid grid-cols-1 items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {/* connector overlay — static rail + flowing signal + moving data packet */}
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" style={{ zIndex: 0 }}>
          {lines.map((l) => (
            <g key={l.id}>
              <path d={l.d} fill="none" stroke={`${l.color}${l.active ? "99" : "2e"}`} strokeWidth={l.active ? 1.6 : 1} />
              {l.active && (
                <>
                  <path className="flow-line" d={l.d} fill="none" stroke={l.color} strokeWidth={1.8} strokeLinecap="round" />
                  {/* data packet routed Core → Agent */}
                  <circle r={5} fill={l.color} opacity={0.25}>
                    <animateMotion dur="1.9s" repeatCount="indefinite" path={l.d} />
                  </circle>
                  <circle r={2.4} fill="#eaf6ff">
                    <animateMotion dur="1.9s" repeatCount="indefinite" path={l.d} />
                    <animate attributeName="opacity" dur="1.9s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.15;0.85;1" />
                  </circle>
                </>
              )}
            </g>
          ))}
        </svg>

        {/* left agents */}
        <div className="relative z-10 space-y-3">{left.map(renderNode)}</div>

        {/* core — the dominant AI reactor */}
        <div className="relative z-10 flex flex-col items-center justify-center px-2 py-2">
          {/* broad light diffusion so the core out-weighs the surrounding cards */}
          <div className="core-aura" />
          <div ref={coreRef} className="relative flex items-center justify-center" style={{ width: 300, height: 300 }}>
            <div className="core-halo" />
            {/* ambient particle field + neural sparks (behind the brain) */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-70">
              <ParticleField size={300} />
            </div>
            {/* slow expanding energy waves from the reactor */}
            <span className="energy-wave" style={{ width: 176, height: 176 }} />
            <span className="energy-wave" style={{ width: 176, height: 176, animationDelay: "1.5s" }} />
            <span className="energy-wave" style={{ width: 176, height: 176, animationDelay: "3s" }} />
            {/* faint counter-rotating neural rings */}
            <span className="neural-ring spin-vslow" style={{ width: 268, height: 268 }} />
            <span className="neural-ring spin-vslow-rev" style={{ width: 290, height: 290, borderColor: "rgba(56,189,248,0.14)" }} />
            <HoloBrain size={300} />
            {/* tight tick-marked HUD ring hugging the orb */}
            <svg className="pointer-events-none absolute inset-0" viewBox="0 0 260 260" width={300} height={300}>
              <g className="spin-vslow" style={{ transformOrigin: "130px 130px" }}>
                {Array.from({ length: 72 }).map((_, i) => {
                  const ang = (i / 72) * Math.PI * 2;
                  const long = i % 6 === 0;
                  const r1 = long ? 95 : 99;
                  const r2 = 103;
                  return (
                    <line
                      key={i}
                      x1={130 + Math.cos(ang) * r1} y1={130 + Math.sin(ang) * r1}
                      x2={130 + Math.cos(ang) * r2} y2={130 + Math.sin(ang) * r2}
                      stroke={long ? "rgba(125,211,252,0.85)" : "rgba(125,211,252,0.4)"}
                      strokeWidth={long ? 1.4 : 0.8}
                    />
                  );
                })}
              </g>
              {/* main bright circle */}
              <circle cx={130} cy={130} r={104} fill="none" stroke="rgba(125,211,252,0.65)" strokeWidth={1.4} />
              <circle cx={130} cy={130} r={104} fill="none" stroke="#7dd3fc" strokeWidth={2.5} opacity={0.35} style={{ filter: "blur(2px)" }} />
              {/* four bright quadrant brackets, counter-rotating */}
              <g className="spin-vslow-rev" style={{ transformOrigin: "130px 130px" }}>
                {[0, 90, 180, 270].map((deg) => (
                  <circle
                    key={deg}
                    cx={130} cy={130} r={110} fill="none"
                    stroke="#a78bfa" strokeWidth={2} strokeLinecap="round"
                    strokeDasharray="26 147" opacity={0.7}
                    transform={`rotate(${deg} 130 130)`}
                  />
                ))}
              </g>
            </svg>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px]">
            <span className="ping-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ ["--glow" as string]: "#34d399" }} />
            <span className="font-semibold text-slate-200">{totalProcessing} agents live</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">{totalRuns} runs today</span>
            <span className="text-sky-300 blink">Real-time</span>
          </div>
        </div>

        {/* right agents */}
        <div className="relative z-10 space-y-3">{right.map(renderNode)}</div>
      </div>
    </section>
  );
}
