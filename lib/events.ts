import { supabaseAdmin } from "./supabase";

export type AgentEventType =
  | "received"
  | "stt"
  | "tool_call"
  | "llm"
  | "tts"
  | "sent"
  | "crm"
  | "alert"
  | "error";

// Live "what the agent is doing" feed (dashboard subscribes via Realtime).
export async function logEvent(
  phone: string | null,
  event_type: AgentEventType,
  label: string,
  detail: Record<string, unknown> = {},
  agent: string | null = null
): Promise<void> {
  try {
    await supabaseAdmin().from("agent_events").insert({ phone, event_type, label, detail, agent });
  } catch (e) {
    console.error("logEvent failed", e);
  }
}

// Conversation transcript (doubles as agent memory).
export async function logMessage(row: {
  phone: string;
  role: "user" | "assistant";
  msg_type?: "text" | "voice" | "image";
  content?: string | null;
  transcript?: string | null;
  audio_url?: string | null;
  image_urls?: string[];
  language_code?: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin().from("messages").insert({
      phone: row.phone,
      role: row.role,
      msg_type: row.msg_type ?? "text",
      content: row.content ?? null,
      transcript: row.transcript ?? null,
      audio_url: row.audio_url ?? null,
      image_urls: row.image_urls ?? [],
      language_code: row.language_code ?? null,
    });
  } catch (e) {
    console.error("logMessage failed", e);
  }
}

// Recent turns for agent memory (oldest first).
export async function recentHistory(
  phone: string,
  limit = 20
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const { data } = await supabaseAdmin()
    .from("messages")
    .select("role, content, transcript")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data) return [];
  return data
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: (m.content || m.transcript || "").toString(),
    }))
    .filter((m) => m.content.trim() !== "");
}
