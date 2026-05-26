import type OpenAI from "openai";
import type { AgentResult, AgentContext } from "../types";

export type AgentName =
  | "lead_qualification"
  | "property_recommendation"
  | "site_visit_booking"
  | "concierge"
  | "follow_up"
  | "reactivation";

export const AGENT_LABELS: Record<AgentName, string> = {
  lead_qualification: "Lead Qualification",
  property_recommendation: "Property Recommendation",
  site_visit_booking: "Site Visit Booking",
  concierge: "Concierge / FAQ",
  follow_up: "Follow-up",
  reactivation: "Reactivation",
};

export const AGENT_ORDER: AgentName[] = [
  "lead_qualification",
  "property_recommendation",
  "site_visit_booking",
  "concierge",
  "follow_up",
  "reactivation",
];

export type HandoffTarget =
  | "none"
  | "property_recommendation"
  | "site_visit_booking"
  | "concierge"
  | "done";

// Superset of fields any specialist can return via the `respond` tool.
export type SpecialistResult = AgentResult & {
  qualified: boolean;
  wants_visit: boolean;
  purpose: string;
  handoff_to: HandoffTarget;
};

export type AgentDef = {
  name: AgentName;
  label: string;
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  systemPrompt: (ctx: AgentContext, nowIst: string, shared: Partial<SpecialistResult>) => string;
};
