"use client";

import { useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { useRealtime } from "@/lib/use-realtime";
import { getBrowserClient } from "@/lib/supabase-browser";
import { prettyVisitDate, prettyVisitTime } from "@/lib/format";

type Visit = {
  id: string;
  lead_phone: string | null;
  customer_name: string | null;
  property: string | null;
  visit_date: string | null;
  visit_time: string | null;
  status: string | null;
  calendar_link: string | null;
  notes: string | null;
  created_at: string;
};

const STATUSES = ["Scheduled", "Completed", "Cancelled", "No-show"];
const TIME_SLOTS = ["10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];

const STATUS_STYLE: Record<string, string> = {
  Scheduled: "bg-emerald-500/15 text-emerald-300",
  Completed: "bg-blue-500/15 text-blue-300",
  Cancelled: "bg-red-500/15 text-red-300",
  "No-show": "bg-amber-500/15 text-amber-300",
};

// site_visits stores dates as "dd-MM-yyyy"; <input type=date> uses "yyyy-MM-dd".
function toInputDate(d?: string | null): string {
  if (!d) return "";
  const [dd, mm, yyyy] = d.split("-");
  return yyyy && mm && dd ? `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` : "";
}
function fromInputDate(d: string): string {
  if (!d) return "";
  const [yyyy, mm, dd] = d.split("-");
  return yyyy && mm && dd ? `${dd}-${mm}-${yyyy}` : "";
}

type Form = {
  customer_name: string;
  lead_phone: string;
  property: string;
  visit_date: string; // yyyy-MM-dd (input value)
  visit_time: string;
  status: string;
};

const EMPTY: Form = { customer_name: "", lead_phone: "", property: "", visit_date: "", visit_time: "10:00 AM", status: "Scheduled" };

function formFromVisit(v: Visit): Form {
  return {
    customer_name: v.customer_name || "",
    lead_phone: v.lead_phone || "",
    property: v.property || "",
    visit_date: toInputDate(v.visit_date),
    visit_time: v.visit_time || "10:00 AM",
    status: v.status || "Scheduled",
  };
}

export default function VisitsPage() {
  // event "*" so manual edits / status changes reflect live, not just new rows.
  const visits = useRealtime<Visit>("site_visits", { event: "*", limit: 300 });
  const [editing, setEditing] = useState<Visit | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openNew() {
    setForm(EMPTY);
    setError("");
    setEditing("new");
  }
  function openEdit(v: Visit) {
    setForm(formFromVisit(v));
    setError("");
    setEditing(v);
  }

  async function save() {
    if (!form.visit_date || !form.visit_time.trim()) {
      setError("Date and time are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await getBrowserClient().auth.getSession();
      const token = data.session?.access_token ?? "";
      const isNew = editing === "new";
      const payload = {
        ...(isNew ? {} : { id: (editing as Visit).id }),
        customer_name: form.customer_name,
        lead_phone: form.lead_phone,
        property: form.property,
        visit_date: fromInputDate(form.visit_date),
        visit_time: form.visit_time.trim(),
        status: form.status,
      };
      const res = await fetch("/api/visits", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Could not save. Please try again.");
        return;
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  const scheduled = visits.filter((v) => (v.status || "Scheduled") === "Scheduled").length;

  return (
    <DashboardShell title="Site Visits">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={openNew}
          className="rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          + Add visit
        </button>
        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">{scheduled} scheduled · {visits.length} total</span>
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              {["Customer", "Phone", "Property", "Date", "Time", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => (
              <tr key={v.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-slate-100">{v.customer_name || "—"}</td>
                <td className="px-4 py-3 text-slate-400">{v.lead_phone || "—"}</td>
                <td className="px-4 py-3 text-slate-300">{v.property || "—"}</td>
                <td className="px-4 py-3 text-slate-300">{prettyVisitDate(v.visit_date)}</td>
                <td className="px-4 py-3 text-slate-300 tabular-nums">{prettyVisitTime(v.visit_time)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLE[v.status || "Scheduled"] || STATUS_STYLE.Scheduled}`}>
                    {v.status || "Scheduled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(v)} className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-white/10">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {visits.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">No site visits booked yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setEditing(null)}>
          <div className="glass w-full max-w-md rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold text-slate-100">{editing === "new" ? "Add site visit" : "Edit site visit"}</h3>
            <div className="space-y-3">
              <Field label="Customer name">
                <input className={inputCls} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="e.g. Rahul Sharma" />
              </Field>
              <Field label="Phone">
                <input className={inputCls} value={form.lead_phone} onChange={(e) => setForm({ ...form, lead_phone: e.target.value })} placeholder="91XXXXXXXXXX" />
              </Field>
              <Field label="Property">
                <input className={inputCls} value={form.property} onChange={(e) => setForm({ ...form, property: e.target.value })} placeholder="Project / property name" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input type="date" className={inputCls} value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />
                </Field>
                <Field label="Time">
                  <input list="time-slots" className={inputCls} value={form.visit_time} onChange={(e) => setForm({ ...form, visit_time: e.target.value })} placeholder="hh:mm AM/PM" />
                  <datalist id="time-slots">
                    {TIME_SLOTS.map((t) => <option key={t} value={t} />)}
                  </datalist>
                </Field>
              </div>
              <Field label="Status">
                <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s} className="bg-slate-800">{s}</option>)}
                </select>
              </Field>
            </div>

            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} disabled={saving} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-400/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}
