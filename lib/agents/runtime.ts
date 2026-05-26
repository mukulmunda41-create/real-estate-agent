import type OpenAI from "openai";
import { openai } from "../openai";
import { env } from "../env";
import { executeTool } from "../tools";
import { logEvent, recentHistory } from "../events";
import type { AgentContext, ConversationType } from "../types";
import type { AgentDef, SpecialistResult, HandoffTarget } from "./types";

const VALID_TYPES: ConversationType[] = [
  "property_inquiry",
  "pricing_query",
  "site_visit_booking",
  "general_query",
  "investment_inquiry",
];

// Shared terminal tool used by every specialist.
const respondTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "respond",
    description: "Deliver your reply and structured output. Call this exactly once at the end of your turn.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Reply text — short and conversational, 1-2 sentences like a real WhatsApp chat. Sent as WhatsApp text." },
        voice_summary: { type: "string", description: "One short spoken sentence in the customer's language (for voice replies)." },
        has_image: { type: "boolean" },
        image_urls: { type: "array", items: { type: "string" } },
        properties_mentioned: { type: "array", items: { type: "string" } },
        customer_name: { type: "string" },
        budget: { type: "string" },
        preferred_location: { type: "string" },
        bhk_config: { type: "string" },
        purpose: { type: "string", description: "end-use or investment" },
        appointment_info: { type: "string" },
        visit_date: { type: "string", description: "dd-MM-yyyy" },
        visit_time: { type: "string", description: "hh:mm AM/PM" },
        qualified: { type: "boolean", description: "Lead-qual agent: true when enough preferences gathered." },
        wants_visit: { type: "boolean", description: "Recommendation agent: true when customer wants a site visit." },
        conversation_complete: { type: "boolean", description: "Booking agent: true once a site visit is booked." },
        conversation_type: { type: "string", enum: VALID_TYPES },
        handoff_to: {
          type: "string",
          enum: ["none", "property_recommendation", "site_visit_booking", "concierge", "done"],
          description: "Hand control to another agent within this turn, or 'none' to reply directly.",
        },
      },
      required: ["message", "voice_summary", "conversation_type", "handoff_to"],
    },
  },
};

function normalize(raw: Record<string, unknown>, ctx: AgentContext): SpecialistResult {
  const str = (v: unknown) => (v == null ? "" : String(v).trim());
  const bool = (v: unknown) => v === true || v === "true";
  const imageUrls = Array.isArray(raw.image_urls) ? raw.image_urls.map(String).filter((u) => u.trim()) : [];
  const props = Array.isArray(raw.properties_mentioned) ? raw.properties_mentioned.map(String).filter(Boolean) : [];
  const ctype = (VALID_TYPES as string[]).includes(String(raw.conversation_type))
    ? (raw.conversation_type as ConversationType)
    : "general_query";
  const handoff = ["none", "property_recommendation", "site_visit_booking", "concierge", "done"].includes(String(raw.handoff_to))
    ? (raw.handoff_to as HandoffTarget)
    : "none";

  return {
    message: str(raw.message) || "How can I help you with your property search today?",
    voice_summary: str(raw.voice_summary) || str(raw.message).split(/[.!?]/)[0],
    has_image: bool(raw.has_image) && imageUrls.length > 0,
    image_urls: imageUrls,
    properties_mentioned: props,
    customer_name: str(raw.customer_name),
    customer_phone: ctx.phone,
    budget: str(raw.budget),
    preferred_location: str(raw.preferred_location),
    bhk_config: str(raw.bhk_config),
    purpose: str(raw.purpose),
    appointment_requested: bool(raw.wants_visit),
    appointment_info: str(raw.appointment_info),
    calendar_event_link: "",
    visit_date: str(raw.visit_date),
    visit_time: str(raw.visit_time),
    conversation_type: ctype,
    conversation_complete: bool(raw.conversation_complete),
    qualified: bool(raw.qualified),
    wants_visit: bool(raw.wants_visit),
    handoff_to: handoff,
  };
}

// Runs a single specialist agent's tool-calling loop.
export async function runSpecialist(
  def: AgentDef,
  ctx: AgentContext,
  history: { role: "user" | "assistant"; content: string }[],
  shared: Partial<SpecialistResult>
): Promise<SpecialistResult> {
  const nowIst = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  await logEvent(ctx.phone, "llm", `${def.label} activated`, {}, def.name);

  const userTurn: OpenAI.Chat.Completions.ChatCompletionUserMessageParam = ctx.imageDataUrl
    ? {
        role: "user",
        content: [
          { type: "text", text: ctx.userText },
          { type: "image_url", image_url: { url: ctx.imageDataUrl } },
        ],
      }
    : { role: "user", content: ctx.userText };

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: def.systemPrompt(ctx, nowIst, shared) },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    userTurn,
  ];

  const tools = [...def.tools, respondTool];

  for (let i = 0; i < 5; i++) {
    const completion = await openai().chat.completions.create({
      model: env.openaiChatModel,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.4,
    });
    const msg = completion.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return normalize({ message: msg.content ?? "", handoff_to: "none" }, ctx);
    }

    let finalArgs: Record<string, unknown> | null = null;
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(tc.function.arguments || "{}");
      } catch {
        parsed = {};
      }
      if (tc.function.name === "respond") {
        finalArgs = parsed;
        continue;
      }
      await logEvent(ctx.phone, "tool_call", `${tc.function.name}`, parsed, def.name);
      const out = await executeTool(tc.function.name, parsed, { phone: ctx.phone, agent: def.name });
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) });
    }

    if (finalArgs) return normalize(finalArgs, ctx);
  }

  return normalize({ message: "Let me check that and get back to you shortly.", handoff_to: "none" }, ctx);
}

export { recentHistory };
