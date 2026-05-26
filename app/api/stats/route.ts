import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function istParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000);
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

function last7Days(): string[] {
  const today = istParts(new Date().toISOString()).day;
  const base = new Date(today + "T00:00:00Z").getTime();
  return Array.from({ length: 7 }, (_, i) => new Date(base - (6 - i) * 86400000).toISOString().slice(0, 10));
}

function series(rows: { created_at: string }[], days: string[]): number[] {
  const map = Object.fromEntries(days.map((d) => [d, 0]));
  for (const r of rows) {
    const d = istParts(r.created_at).day;
    if (d in map) map[d]++;
  }
  return days.map((d) => map[d]);
}

function delta(s: number[]): number {
  const recent = s.slice(4).reduce((a, b) => a + b, 0);
  const prior = s.slice(1, 4).reduce((a, b) => a + b, 0) || 0;
  if (prior === 0) return recent > 0 ? 100 : 0;
  return Math.round(((recent - prior) / prior) * 1000) / 10;
}

export async function GET(req: NextRequest) {
  if (!(await requireUser(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const [leadsR, visitsR, msgsR, propsR] = await Promise.all([
    sb.from("leads").select("stage,lead_type,created_at,properties_mentioned,phone"),
    sb.from("site_visits").select("created_at"),
    sb.from("messages").select("phone,role,created_at").order("created_at", { ascending: false }).limit(3000),
    sb.from("properties").select("name,price_numeric"),
  ]);

  const leads = leadsR.data ?? [];
  const visits = visitsR.data ?? [];
  const msgs = msgsR.data ?? [];
  const props = propsR.data ?? [];
  const days = last7Days();

  // Active conversations (distinct phones in last 24h)
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const activePhones = new Set(msgs.filter((m) => new Date(m.created_at).getTime() >= cutoff).map((m) => m.phone));

  // Revenue pipeline: sum price of the top property each lead is interested in
  const priceByName: Record<string, number> = {};
  for (const p of props) priceByName[(p.name || "").toLowerCase()] = Number(p.price_numeric) || 0;
  let pipeline = 0;
  for (const l of leads) {
    const first = (l.properties_mentioned || [])[0];
    if (first) pipeline += priceByName[String(first).toLowerCase()] || 0;
  }

  const totalLeads = leads.length;
  const totalVisits = visits.length;
  const conversion = totalLeads ? Math.round((totalVisits / totalLeads) * 1000) / 10 : 0;

  // Funnel by stage
  const inStage = (s: string[]) => leads.filter((l) => s.includes(l.stage || "new")).length;
  const funnel = [
    { label: "Leads", count: totalLeads },
    { label: "Qualified", count: inStage(["qualified", "recommending", "booking", "booked"]) },
    { label: "Visit Stage", count: inStage(["booking", "booked"]) },
    { label: "Booked", count: inStage(["booked"]) },
  ];

  // Lead mix by type
  const mixMap: Record<string, number> = {};
  for (const l of leads) {
    const k = l.lead_type || "general_query";
    mixMap[k] = (mixMap[k] || 0) + 1;
  }
  const leadMix = Object.entries(mixMap).map(([label, count]) => ({ label, count }));

  // Heatmap: 7 days x 12 two-hour buckets from message activity
  const heat = Array.from({ length: 7 }, () => Array(12).fill(0));
  for (const m of msgs) {
    const { day, hour } = istParts(m.created_at);
    const di = days.indexOf(day);
    if (di >= 0) heat[di][Math.floor(hour / 2)]++;
  }
  const heatMax = Math.max(1, ...heat.flat());

  return NextResponse.json({
    kpis: {
      totalLeads,
      activeConversations: activePhones.size,
      siteVisits: totalVisits,
      conversion,
      pipeline,
    },
    spark: {
      leads: series(leads, days),
      visits: series(visits, days),
      messages: series(msgs, days),
    },
    deltas: {
      leads: delta(series(leads, days)),
      visits: delta(series(visits, days)),
      messages: delta(series(msgs, days)),
    },
    funnel,
    leadMix,
    heat,
    heatMax,
    aiPerformance: {
      conversion,
      bookings: totalVisits,
      messagesHandled: msgs.length,
      qualifiedRate: totalLeads ? Math.round((funnel[1].count / totalLeads) * 100) : 0,
    },
  });
}
