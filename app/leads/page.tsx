"use client";

import { useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { useRealtime } from "@/lib/use-realtime";

type Lead = {
  id: string;
  phone: string;
  name: string | null;
  budget: string | null;
  preferred_location: string | null;
  bhk_config: string | null;
  lead_type: string | null;
  lead_status: string | null;
  properties_mentioned: string[] | null;
  last_interaction_at: string | null;
};

export default function LeadsPage() {
  const leads = useRealtime<Lead>("leads", { event: "*", limit: 300, orderBy: "last_interaction_at" });
  const [q, setQ] = useState("");

  const filtered = leads.filter((l) =>
    [l.name, l.phone, l.preferred_location, (l.properties_mentioned || []).join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase())
  );

  return (
    <DashboardShell title="Leads">
      <div className="mb-4 flex items-center justify-between gap-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search leads…"
          className="w-72 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-emerald-400/50"
        />
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">{filtered.length} leads</span>
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              {["Name", "Phone", "Budget", "Location", "Config", "Interested In", "Type", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-slate-100">{l.name || "—"}</td>
                <td className="px-4 py-3 text-slate-400">{l.phone}</td>
                <td className="px-4 py-3 text-slate-300">{l.budget || "—"}</td>
                <td className="px-4 py-3 text-slate-300">{l.preferred_location || "—"}</td>
                <td className="px-4 py-3 text-slate-300">{l.bhk_config || "—"}</td>
                <td className="px-4 py-3 text-slate-300">{(l.properties_mentioned || []).join(", ") || "—"}</td>
                <td className="px-4 py-3 text-slate-400">{l.lead_type || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      l.lead_status === "Site Visit Scheduled"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-slate-500/15 text-slate-300"
                    }`}
                  >
                    {l.lead_status || "Active"}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">No leads found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
