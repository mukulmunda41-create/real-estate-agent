import { supabaseAdmin } from "../supabase";
import { runSpecialist, recentHistory } from "./runtime";
import { AGENT_DEFS } from "./definitions";
import { logEvent, logMessage } from "../events";
import { sendText } from "../whatsapp";
import type { AgentContext } from "../types";

type LeadRow = {
  phone: string;
  name: string | null;
  wa_display_name: string | null;
  budget: string | null;
  preferred_location: string | null;
  bhk_config: string | null;
  properties_mentioned: string[] | null;
  stage: string | null;
  followup_count: number | null;
  reactivation_count: number | null;
};

function ctxFor(lead: LeadRow, instruction: string): AgentContext {
  return {
    phone: lead.phone,
    waDisplayName: lead.wa_display_name || lead.name || "",
    userText: instruction,
    isVoice: false,
  };
}

async function runProactive(
  lead: LeadRow,
  agentKey: "follow_up" | "reactivation",
  instruction: string
): Promise<string> {
  const ctx = ctxFor(lead, instruction);
  const history = await recentHistory(lead.phone, 12);
  const shared = {
    budget: lead.budget || "",
    preferred_location: lead.preferred_location || "",
    bhk_config: lead.bhk_config || "",
    properties_mentioned: lead.properties_mentioned || [],
  };
  const res = await runSpecialist(AGENT_DEFS[agentKey], ctx, history, shared);

  try {
    await sendText(lead.phone, res.message);
  } catch (e) {
    await logEvent(lead.phone, "error", "Proactive send failed", { error: String(e) }, agentKey);
  }
  await logMessage({ phone: lead.phone, role: "assistant", msg_type: "text", content: res.message });
  await logEvent(lead.phone, "sent", `${AGENT_DEFS[agentKey].label} message sent`, {}, agentKey);
  return res.message;
}

// Follow-up sweep: leads that showed interest but went quiet (due for follow-up).
export async function sweepFollowUps(limit = 20): Promise<{ processed: number }> {
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin()
    .from("leads")
    .select("*")
    .in("stage", ["qualifying", "qualified", "recommending", "booking"])
    .lte("next_followup_at", nowIso)
    .lt("followup_count", 3)
    .limit(limit);

  const leads = (data ?? []) as LeadRow[];
  for (const lead of leads) {
    await runProactive(
      lead,
      "follow_up",
      "[SYSTEM] This lead engaged earlier but hasn't replied. Send a brief, friendly follow-up with a clear next step."
    );
    await supabaseAdmin()
      .from("leads")
      .update({
        followup_count: (lead.followup_count ?? 0) + 1,
        next_followup_at: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
      })
      .eq("phone", lead.phone);
  }
  return { processed: leads.length };
}

// Reactivation sweep: cold leads (no inbound for 7+ days, not booked).
export async function sweepReactivations(limit = 20): Promise<{ processed: number }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabaseAdmin()
    .from("leads")
    .select("*")
    .neq("stage", "booked")
    .lte("last_inbound_at", cutoff)
    .lt("reactivation_count", 2)
    .limit(limit);

  const leads = (data ?? []) as LeadRow[];
  for (const lead of leads) {
    await runProactive(
      lead,
      "reactivation",
      "[SYSTEM] This lead has been cold for a while. Send a fresh, low-pressure re-engagement message."
    );
    await supabaseAdmin()
      .from("leads")
      .update({
        reactivation_count: (lead.reactivation_count ?? 0) + 1,
        stage: "cold",
      })
      .eq("phone", lead.phone);
  }
  return { processed: leads.length };
}
