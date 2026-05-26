import { supabaseAdmin } from "./supabase";
import { openai } from "./openai";
import { env } from "./env";
import { sendText } from "./whatsapp";
import { logEvent } from "./events";
import type { AgentContext, AgentResult } from "./types";

export function displayName(result: AgentResult, ctx: AgentContext): string {
  if (result.customer_name.trim()) return result.customer_name.trim();
  if (ctx.waDisplayName.trim()) return ctx.waDisplayName.trim();
  const wa = ctx.phone;
  return wa.startsWith("91") ? `+91 ${wa.slice(2)}` : `+${wa}`;
}

export async function upsertLead(
  ctx: AgentContext,
  result: AgentResult,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const row = {
    phone: ctx.phone,
    name: displayName(result, ctx),
    wa_display_name: ctx.waDisplayName || null,
    properties_mentioned: result.properties_mentioned,
    budget: result.budget || null,
    preferred_location: result.preferred_location || null,
    bhk_config: result.bhk_config || null,
    lead_type: result.conversation_type,
    lead_status: result.conversation_complete ? "Site Visit Scheduled" : "Active",
    last_message: result.message,
    last_interaction_at: new Date().toISOString(),
    ...extra,
  };
  const { error } = await supabaseAdmin().from("leads").upsert(row, { onConflict: "phone" });
  if (error) {
    await logEvent(ctx.phone, "error", "Lead upsert failed", { error: error.message });
    return;
  }
  await logEvent(ctx.phone, "crm", "Lead updated", { name: row.name, status: row.lead_status });
}

export async function sendManagerAlert(ctx: AgentContext, result: AgentResult): Promise<void> {
  if (!env.managerPhone) return;
  const name = displayName(result, ctx);
  let alertText = "";
  try {
    const completion = await openai().chat.completions.create({
      model: env.openaiChatModel,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are a sales reporting assistant. Generate a concise WhatsApp alert (max 12 lines, emojis ok, plain text only — no JSON, no markdown).",
        },
        {
          role: "user",
          content: `New site visit booked:
- Name: ${name}
- Phone: ${result.customer_phone || ctx.phone}
- Property: ${result.properties_mentioned.join(", ") || "Not specified"}
- Budget: ${result.budget || "Not provided"}
- Config: ${result.bhk_config || "Not specified"}
- Visit Date: ${result.visit_date || "Not set"}
- Visit Time: ${result.visit_time || "Not set"}
- Info: ${result.appointment_info}
End with a short follow-up action note for the team.`,
        },
      ],
    });
    alertText = completion.choices[0].message.content?.trim() || "";
  } catch {
    alertText = "";
  }
  if (!alertText) {
    alertText = `🏠 New site visit booked by ${name}. Check the dashboard for details.`;
  }
  await sendText(env.managerPhone, alertText);
  await logEvent(ctx.phone, "alert", "Manager alerted", {});
}
