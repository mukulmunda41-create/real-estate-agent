"use client";

import DashboardShell from "@/components/DashboardShell";
import { useRealtime } from "@/lib/use-realtime";

type Visit = {
  id: string;
  lead_phone: string | null;
  customer_name: string | null;
  property: string | null;
  visit_date: string | null;
  visit_time: string | null;
  status: string | null;
  created_at: string;
};

export default function VisitsPage() {
  const visits = useRealtime<Visit>("site_visits", { limit: 300 });

  return (
    <DashboardShell title="Site Visits">
      <div className="mb-4 flex items-center justify-end">
        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">{visits.length} scheduled</span>
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              {["Customer", "Phone", "Property", "Date", "Time", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => (
              <tr key={v.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-slate-100">{v.customer_name || "—"}</td>
                <td className="px-4 py-3 text-slate-400">{v.lead_phone}</td>
                <td className="px-4 py-3 text-slate-300">{v.property || "—"}</td>
                <td className="px-4 py-3 text-slate-300">{v.visit_date || "—"}</td>
                <td className="px-4 py-3 text-slate-300">{v.visit_time || "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                    {v.status || "Scheduled"}
                  </span>
                </td>
              </tr>
            ))}
            {visits.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No site visits booked yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
