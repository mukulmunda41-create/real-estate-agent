import { runSpecialist } from "./runtime";
import { AGENT_DEFS } from "./definitions";
import { AGENT_LABELS, type AgentName, type SpecialistResult } from "./types";
import { logEvent } from "../events";
import type { AgentContext, ChatTurn } from "../types";

export type OrchestrationResult = SpecialistResult & {
  stage: string;
  activeAgent: AgentName;
  agentsRun: AgentName[];
};

function agentForStage(stage: string): AgentName {
  switch (stage) {
    case "qualified":
    case "recommending":
      return "property_recommendation";
    case "booking":
      return "site_visit_booking";
    case "booked":
      return "concierge";
    default:
      return "lead_qualification";
  }
}

function nextStage(agent: AgentName, r: SpecialistResult, current: string): string {
  if (agent === "lead_qualification") return r.qualified ? "qualified" : "qualifying";
  if (agent === "property_recommendation") return r.wants_visit ? "booking" : "recommending";
  if (agent === "site_visit_booking") return r.conversation_complete ? "booked" : "booking";
  return current;
}

function merge(prev: Partial<SpecialistResult>, r: SpecialistResult): Partial<SpecialistResult> {
  const keep = (a: string, b: string) => (b && b.trim() ? b : a || "");
  return {
    ...prev,
    budget: keep(prev.budget || "", r.budget),
    preferred_location: keep(prev.preferred_location || "", r.preferred_location),
    bhk_config: keep(prev.bhk_config || "", r.bhk_config),
    purpose: keep(prev.purpose || "", r.purpose),
    customer_name: keep(prev.customer_name || "", r.customer_name),
    appointment_info: keep(prev.appointment_info || "", r.appointment_info),
    visit_date: keep(prev.visit_date || "", r.visit_date),
    visit_time: keep(prev.visit_time || "", r.visit_time),
    properties_mentioned: r.properties_mentioned.length ? r.properties_mentioned : prev.properties_mentioned || [],
    qualified: r.qualified || prev.qualified,
    conversation_complete: r.conversation_complete || prev.conversation_complete,
  };
}

// Inbound orchestration: pick the agent for the lead's stage, run it, follow
// in-turn handoffs (e.g. qualify → recommend → book) up to 3 agents.
export async function orchestrate(
  ctx: AgentContext,
  startStage: string,
  history: ChatTurn[],
  seed: Partial<SpecialistResult> = {}
): Promise<OrchestrationResult> {
  let agent = agentForStage(startStage || "new");
  let stage = startStage || "new";
  // Start from the lead's known durable facts so they're re-injected into each
  // specialist's prompt and carried back into the upsert even when the active
  // agent doesn't re-state them this turn.
  let merged: Partial<SpecialistResult> = { ...seed };
  let last!: SpecialistResult;
  const agentsRun: AgentName[] = [];

  await logEvent(ctx.phone, "received", `Routed to ${AGENT_LABELS[agent]}`, { stage }, "orchestrator");

  for (let hop = 0; hop < 3; hop++) {
    agentsRun.push(agent);
    const res = await runSpecialist(AGENT_DEFS[agent], ctx, history, merged);
    last = res;
    merged = merge(merged, res);
    stage = nextStage(agent, res, stage);

    const target = res.handoff_to;
    if (
      (target === "property_recommendation" ||
        target === "site_visit_booking" ||
        target === "concierge") &&
      target !== agent &&
      hop < 2
    ) {
      await logEvent(ctx.phone, "tool_call", `Handoff → ${AGENT_LABELS[target]}`, { from: agent }, "orchestrator");
      agent = target;
      continue;
    }
    break;
  }

  return {
    ...(merged as SpecialistResult),
    message: last.message,
    voice_summary: last.voice_summary,
    image_urls: last.image_urls,
    has_image: last.has_image,
    conversation_type: last.conversation_type,
    customer_phone: ctx.phone,
    calendar_event_link: "",
    appointment_requested: last.appointment_requested,
    handoff_to: last.handoff_to,
    wants_visit: last.wants_visit,
    stage,
    activeAgent: agent,
    agentsRun,
  };
}
