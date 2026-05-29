import { orchestrate } from "./agents/orchestrator";
import { logEvent, logMessage, recentHistory } from "./events";
import { upsertLead, sendManagerAlert } from "./crm";
import { stt, tts } from "./gemini";
import {
  sendText,
  sendImageById,
  sendAudioById,
  uploadMedia,
  downloadMedia,
  fetchImage,
  markAsRead,
} from "./whatsapp";
import { supabaseAdmin } from "./supabase";
import type { AgentContext } from "./types";

export type Inbound = {
  phone: string;
  waDisplayName: string;
  messageId?: string;
  type: "text" | "audio" | "image" | "other";
  text?: string;
  mediaId?: string;
};

// Max inbound messages we'll act on per phone per minute (cost / abuse guard).
const RATE_LIMIT_PER_MIN = 15;

// Idempotency: claim a WhatsApp message id. Returns true if it was already
// handled (Meta delivered a duplicate / retry) and should be skipped.
async function alreadyProcessed(messageId?: string): Promise<boolean> {
  if (!messageId) return false;
  const { error } = await supabaseAdmin()
    .from("processed_messages")
    .insert({ wa_message_id: messageId });
  if (error) return error.code === "23505"; // unique_violation => duplicate
  return false;
}

async function rateLimited(phone: string): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 1000).toISOString();
  const { count } = await supabaseAdmin()
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .eq("role", "user")
    .gte("created_at", since);
  return (count ?? 0) >= RATE_LIMIT_PER_MIN;
}

async function archiveAudio(
  phone: string,
  bytes: Buffer,
  mimeType: string,
  dir: "in" | "out"
): Promise<string | null> {
  try {
    const ext = mimeType.includes("mpeg") ? "mp3" : mimeType.includes("ogg") ? "ogg" : "bin";
    const path = `${phone}/${dir}_${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin()
      .storage.from("voice-notes")
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

export async function handleInbound(msg: Inbound): Promise<void> {
  if (await alreadyProcessed(msg.messageId)) return;
  if (msg.messageId) await markAsRead(msg.messageId);

  let userText = msg.text || "";
  let languageCode: string | undefined;
  let isVoice = false;
  let inAudioUrl: string | null = null;
  let imageDataUrl: string | undefined;

  if (msg.type === "audio" && msg.mediaId) {
    isVoice = true;
    await logEvent(msg.phone, "received", "Voice note received");
    const { bytes, mimeType } = await downloadMedia(msg.mediaId);
    inAudioUrl = await archiveAudio(msg.phone, bytes, mimeType, "in");
    const r = await stt(bytes, mimeType, "voice_in.ogg");
    userText = r.transcript;
    languageCode = r.languageCode;
    await logEvent(msg.phone, "stt", "Transcribed voice", { transcript: userText, language: languageCode });
  } else if (msg.type === "image") {
    await logEvent(msg.phone, "received", "Image received");
    if (msg.mediaId) {
      try {
        const { bytes, mimeType } = await downloadMedia(msg.mediaId);
        imageDataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
      } catch (e) {
        await logEvent(msg.phone, "error", "Image download failed", { error: String(e) });
      }
    }
    userText = msg.text || "(The customer sent an image. Look at it and respond appropriately.)";
  } else if (msg.type === "text") {
    await logEvent(msg.phone, "received", "Text received", { text: userText });
  } else {
    return;
  }

  if (!userText.trim() && !imageDataUrl) {
    await sendText(msg.phone, "Sorry, I couldn't catch that. Could you please type or say it again?");
    return;
  }

  if (await rateLimited(msg.phone)) {
    await logEvent(msg.phone, "error", "Rate limit hit — skipping", {});
    await sendText(msg.phone, "You're sending messages a bit fast — give me a moment to catch up and try again shortly. 🙏");
    return;
  }

  // Load prior turns BEFORE logging the current one, so the current message
  // isn't duplicated (once in history + once as the live user turn).
  const history = await recentHistory(msg.phone, 20);

  await logMessage({
    phone: msg.phone,
    role: "user",
    msg_type: isVoice ? "voice" : msg.type === "image" ? "image" : "text",
    content: isVoice ? null : userText,
    transcript: isVoice ? userText : null,
    audio_url: inAudioUrl,
    language_code: languageCode,
  });

  const ctx: AgentContext = {
    phone: msg.phone,
    waDisplayName: msg.waDisplayName,
    userText,
    languageCode,
    isVoice,
    imageDataUrl,
  };

  const { data: existing } = await supabaseAdmin()
    .from("leads")
    .select("stage")
    .eq("phone", msg.phone)
    .maybeSingle();
  const result = await orchestrate(ctx, existing?.stage || "new", history);

  // 1) Property images (if any)
  if (result.has_image && result.image_urls.length) {
    for (const url of result.image_urls.slice(0, 5)) {
      try {
        const { bytes, mimeType } = await fetchImage(url);
        const mediaId = await uploadMedia(bytes, mimeType, "property.jpg");
        await sendImageById(msg.phone, mediaId);
      } catch (e) {
        await logEvent(msg.phone, "error", "Image send failed", { url, error: String(e) });
      }
    }
  }

  // 2) Short voice reply — only when the customer used voice
  let outAudioUrl: string | null = null;
  if (isVoice && result.voice_summary) {
    try {
      const mp3 = await tts(result.voice_summary, languageCode);
      outAudioUrl = await archiveAudio(msg.phone, mp3, "audio/mpeg", "out");
      const mediaId = await uploadMedia(mp3, "audio/mpeg", "reply.mp3");
      await sendAudioById(msg.phone, mediaId);
      await logEvent(msg.phone, "tts", "Voice reply sent", { text: result.voice_summary });
    } catch (e) {
      await logEvent(msg.phone, "error", "TTS failed", { error: String(e) });
    }
  }

  // 3) Full detail text (always)
  await sendText(msg.phone, result.message);
  await logEvent(msg.phone, "sent", "Reply sent");
  await logMessage({
    phone: msg.phone,
    role: "assistant",
    msg_type: isVoice ? "voice" : "text",
    content: result.message,
    audio_url: outAudioUrl,
    image_urls: result.image_urls,
    language_code: languageCode,
  });

  // 4) CRM — persist pipeline stage + schedule next follow-up
  const nowIso = new Date().toISOString();
  const nextFollowup =
    result.stage === "booked" ? null : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await upsertLead(ctx, result, {
    stage: result.stage,
    last_inbound_at: nowIso,
    next_followup_at: nextFollowup,
    followup_count: 0,
    reactivation_count: 0,
  });
  if (result.conversation_complete) await sendManagerAlert(ctx, result);
}
