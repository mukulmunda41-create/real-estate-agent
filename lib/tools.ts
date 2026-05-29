import type OpenAI from "openai";
import { supabaseAdmin } from "./supabase";
import { embed } from "./embeddings";
import { logEvent } from "./events";
import { createCalendarEvent, istWindow } from "./google-calendar";
import type { PropertyMatch } from "./types";

// ----- Tool schemas exposed to the model -----
export const toolDefs: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_properties",
      description:
        "Search the real estate knowledge base. Use for ANY question about properties, pricing, location, BHK/plot config, amenities, possession, availability. Returns price, area, possession, amenities and image URLs. ALWAYS use this — never answer property facts from memory.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Natural language description of what the customer wants, e.g. '2 BHK apartment in Pune under 80 lakh with gym'",
          },
          city: {
            type: "string",
            description: "Restrict results to this city (e.g. 'Pune'). Omit if the customer hasn't said a city.",
          },
          max_price: {
            type: "number",
            description:
              "Maximum budget as a plain number in rupees (e.g. 8000000 for ₹80 lakh, 12000000 for ₹1.2 crore). Omit if no budget cap.",
          },
          max_results: { type: "integer", description: "Default 5" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_calendar",
      description:
        "Check available site-visit slots on a given date before confirming any booking. Office hours Mon-Sat, 10AM-6PM IST.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date in dd-MM-yyyy format" },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_site_visit",
      description:
        "Book a site visit AFTER the customer confirms a slot and you have their name. Creates the booking record.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          property: { type: "string", description: "Project / property name" },
          visit_date: { type: "string", description: "dd-MM-yyyy" },
          visit_time: { type: "string", description: "hh:mm AM/PM" },
        },
        required: ["customer_name", "property", "visit_date", "visit_time"],
      },
    },
  },
];

export function pickTools(names: string[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return toolDefs.filter((t) => t.type === "function" && names.includes(t.function.name));
}

export type ToolCtx = { phone: string; agent?: string };

const OFFICE_HOURS = ["10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolCtx
): Promise<unknown> {
  if (name === "search_properties") {
    const query = String(args.query ?? "");
    const matchCount = Number(args.max_results ?? 5);
    const filterCity = args.city ? String(args.city).trim() || null : null;
    const parsedPrice = args.max_price != null && args.max_price !== "" ? Number(args.max_price) : NaN;
    const maxPrice = Number.isFinite(parsedPrice) ? parsedPrice : null;
    const embedding = await embed(query);
    const { data, error } = await supabaseAdmin().rpc("match_properties", {
      query_embedding: embedding,
      match_count: matchCount,
      filter_city: filterCity,
      max_price: maxPrice,
    });
    if (error) {
      await logEvent(ctx.phone, "error", "search_properties failed", { error: error.message }, ctx.agent);
      return { error: "search failed", results: [] };
    }
    const results = (data as PropertyMatch[]).map((p) => ({
      name: p.name,
      type: p.property_type,
      city: p.city,
      location: p.location,
      bhk_config: p.bhk_config,
      price: p.price,
      carpet_area: p.carpet_area,
      possession: p.possession,
      amenities: p.amenities,
      rera_id: p.rera_id,
      description: p.description,
      image_urls: p.image_urls,
    }));
    return { count: results.length, results };
  }

  if (name === "check_calendar") {
    const date = String(args.date ?? "");
    const { data } = await supabaseAdmin()
      .from("site_visits")
      .select("visit_time")
      .eq("visit_date", date);
    const booked = (data ?? []).map((r) => r.visit_time);
    const available = OFFICE_HOURS.filter((s) => !booked.includes(s));
    return { date, booked, available_slots: available };
  }

  if (name === "book_site_visit") {
    const visitDate = String(args.visit_date ?? "");
    const visitTime = String(args.visit_time ?? "");

    // Guard against double-booking the same slot.
    const { data: clash } = await supabaseAdmin()
      .from("site_visits")
      .select("id")
      .eq("visit_date", visitDate)
      .eq("visit_time", visitTime)
      .neq("status", "Cancelled")
      .maybeSingle();
    if (clash) {
      return {
        success: false,
        error: "slot_taken",
        message: `${visitTime} on ${visitDate} is already booked. Please offer the customer another time.`,
      };
    }

    const customerName = String(args.customer_name ?? "");
    const property = String(args.property ?? "");
    // Proper timestamp alongside the human-readable date/time (best-effort parse).
    let visitAt: string | null = null;
    try {
      visitAt = istWindow(visitDate, visitTime).start;
    } catch {
      visitAt = null;
    }
    const row = {
      lead_phone: ctx.phone,
      customer_name: customerName,
      property,
      visit_date: visitDate,
      visit_time: visitTime,
      visit_at: visitAt,
      status: "Scheduled",
      calendar_link: "",
    };
    const { data, error } = await supabaseAdmin()
      .from("site_visits")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      // Unique index catches a race between the check above and this insert.
      if (error.code === "23505") {
        return {
          success: false,
          error: "slot_taken",
          message: "That slot was just taken. Please offer the customer another time.",
        };
      }
      await logEvent(ctx.phone, "error", "book_site_visit failed", { error: error.message }, ctx.agent);
      return { success: false, error: error.message };
    }

    // Push to Google Calendar (best-effort — booking already succeeded in our DB).
    let calendarLink = "";
    try {
      const ev = await createCalendarEvent({
        summary: `Site visit: ${property || "Property"} — ${customerName || ctx.phone}`,
        description: `Customer: ${customerName || "—"}\nPhone: ${ctx.phone}\nProperty: ${property || "—"}`,
        visitDate,
        visitTime,
      });
      calendarLink = ev.link;
      if (ev.id || ev.link) {
        await supabaseAdmin()
          .from("site_visits")
          .update({ calendar_link: ev.link, calendar_event_id: ev.id })
          .eq("id", data.id);
      }
    } catch (e) {
      await logEvent(ctx.phone, "error", "Calendar event failed", { error: String(e) }, ctx.agent);
    }

    await logEvent(ctx.phone, "crm", "Site visit booked", { ...row, calendar_link: calendarLink }, ctx.agent);
    return { success: true, visit_id: data.id, calendar_link: calendarLink };
  }

  return { error: `unknown tool ${name}` };
}
