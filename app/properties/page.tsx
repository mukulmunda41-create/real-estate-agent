"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { getBrowserClient } from "@/lib/supabase-browser";

type Property = {
  id: string;
  name: string;
  property_type: string | null;
  city: string | null;
  location: string | null;
  bhk_config: string | null;
  price: string | null;
  possession: string | null;
  image_urls: string[] | null;
};

const EMPTY = {
  name: "",
  property_type: "apartment",
  city: "",
  location: "",
  bhk_config: "",
  price: "",
  price_numeric: "",
  carpet_area: "",
  possession: "",
  amenities: "",
  rera_id: "",
  description: "",
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await getBrowserClient().auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data } = await getBrowserClient()
      .from("properties")
      .select("id,name,property_type,city,location,bhk_config,price,possession,image_urls")
      .order("created_at", { ascending: false });
    if (data) setProperties(data as Property[]);
  }, []);

  useEffect(() => {
    // Initial data fetch (async setState, not a synchronous cascade).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function createProperty(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const body = {
      ...form,
      price_numeric: form.price_numeric ? Number(form.price_numeric) : null,
      amenities: form.amenities ? form.amenities.split(",").map((s) => s.trim()).filter(Boolean) : [],
    };
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      setForm(EMPTY);
      setMsg("✓ Property added & embedded into the knowledge base");
      load();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(`Error: ${j.error || res.status}`);
    }
  }

  async function uploadImage(propertyId: string, file: File) {
    setUploading(propertyId);
    const fd = new FormData();
    fd.append("propertyId", propertyId);
    fd.append("file", file);
    const res = await fetch("/api/properties/upload", { method: "POST", headers: await authHeaders(), body: fd });
    setUploading(null);
    if (res.ok) load();
    else {
      const j = await res.json().catch(() => ({}));
      setMsg(`Upload error: ${j.error || res.status}`);
    }
  }

  const input = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-emerald-400/50";

  const field = (key: keyof typeof EMPTY, label: string, type = "text") => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={input} />
    </div>
  );

  return (
    <DashboardShell title="Properties · Knowledge Base">
      <form onSubmit={createProperty} className="glass mb-6 rounded-xl p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-100">＋ Add property</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {field("name", "Name")}
          {field("property_type", "Type (plot/villa/apartment)")}
          {field("city", "City")}
          {field("location", "Location")}
          {field("bhk_config", "Config (2/3 BHK, plot)")}
          {field("price", "Price label")}
          {field("price_numeric", "Price (number)", "number")}
          {field("carpet_area", "Carpet area")}
          {field("possession", "Possession")}
          {field("rera_id", "RERA ID")}
          {field("amenities", "Amenities (comma-separated)")}
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className={input}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            disabled={saving}
            className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? "Embedding…" : "Add property"}
          </button>
          {msg && <span className="text-sm text-emerald-300">{msg}</span>}
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {properties.map((p) => (
          <div key={p.id} className="glass glow-green rounded-xl p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-100">{p.name}</h3>
                <p className="text-xs text-slate-400">{[p.property_type, p.location || p.city].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">{p.price}</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {(p.image_urls || []).map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt={p.name} className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/10" />
              ))}
              {(p.image_urls || []).length === 0 && <span className="text-xs text-slate-500">No images yet</span>}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-emerald-400/50 hover:text-emerald-300">
              {uploading === p.id ? "Uploading…" : "⬆ Upload image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(p.id, f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        ))}
        {properties.length === 0 && (
          <p className="text-sm text-slate-500">
            No properties yet. Add one above or run <code className="text-emerald-300">npm run seed</code>.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
