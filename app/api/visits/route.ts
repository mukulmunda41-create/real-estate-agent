import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createCalendarEvent, istWindow } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["Scheduled", "Completed", "Cancelled", "No-show"];

// Best-effort timestamp from the human-readable date/time (same parse as booking).
function toVisitAt(visitDate?: string, visitTime?: string): string | null {
  if (!visitDate || !visitTime) return null;
  try {
    return istWindow(visitDate, visitTime).start;
  } catch {
    return null;
  }
}

// Create a site visit manually from the dashboard.
export async function POST(req: NextRequest) {
  if (!(await requireUser(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const visit_date = String(b.visit_date ?? "").trim();
  const visit_time = String(b.visit_time ?? "").trim();
  if (!visit_date || !visit_time) {
    return NextResponse.json({ error: "visit_date and visit_time are required" }, { status: 400 });
  }

  const customer_name = String(b.customer_name ?? "").trim();
  const property = String(b.property ?? "").trim();
  const lead_phone = String(b.lead_phone ?? "").trim() || null;
  const status = STATUSES.includes(String(b.status)) ? String(b.status) : "Scheduled";

  const { data, error } = await supabaseAdmin()
    .from("site_visits")
    .insert({
      lead_phone,
      customer_name,
      property,
      visit_date,
      visit_time,
      visit_at: toVisitAt(visit_date, visit_time),
      status,
      calendar_link: "",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That date/time slot is already booked." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Push to Google Calendar (best-effort — the row is the source of truth).
  if (status !== "Cancelled") {
    try {
      const link = await createCalendarEvent({
        summary: `Site visit: ${property || "Property"} — ${customer_name || lead_phone || "Customer"}`,
        description: `Customer: ${customer_name || "—"}\nPhone: ${lead_phone || "—"}\nProperty: ${property || "—"}`,
        visitDate: visit_date,
        visitTime: visit_time,
      });
      if (link) await supabaseAdmin().from("site_visits").update({ calendar_link: link }).eq("id", data.id);
    } catch {
      /* calendar is optional; booking already saved */
    }
  }

  return NextResponse.json({ ok: true, id: data.id });
}

// Edit an existing site visit (date / time / status / property / customer / notes).
export async function PATCH(req: NextRequest) {
  if (!(await requireUser(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (b.customer_name !== undefined) patch.customer_name = String(b.customer_name).trim();
  if (b.property !== undefined) patch.property = String(b.property).trim();
  if (b.lead_phone !== undefined) patch.lead_phone = String(b.lead_phone).trim() || null;
  if (b.visit_date !== undefined) patch.visit_date = String(b.visit_date).trim();
  if (b.visit_time !== undefined) patch.visit_time = String(b.visit_time).trim();
  if (b.notes !== undefined) patch.notes = String(b.notes);
  if (b.status !== undefined && STATUSES.includes(String(b.status))) patch.status = String(b.status);

  // Keep the machine timestamp in sync when date/time change.
  if (patch.visit_date !== undefined || patch.visit_time !== undefined) {
    const { data: cur } = await supabaseAdmin()
      .from("site_visits")
      .select("visit_date,visit_time")
      .eq("id", id)
      .maybeSingle();
    const vd = (patch.visit_date as string) ?? cur?.visit_date;
    const vt = (patch.visit_time as string) ?? cur?.visit_time;
    patch.visit_at = toVisitAt(vd, vt);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from("site_visits").update(patch).eq("id", id);
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That date/time slot is already booked." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
