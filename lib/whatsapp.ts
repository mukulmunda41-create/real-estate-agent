import { createHmac, timingSafeEqual } from "crypto";
import { env } from "./env";

const GRAPH = "https://graph.facebook.com/v21.0";

function authHeaders() {
  return { Authorization: `Bearer ${env.whatsappToken}` };
}

// GET webhook verification (Meta hub challenge).
export function verifyWebhook(params: URLSearchParams): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token === env.whatsappVerifyToken) return challenge;
  return null;
}

// Verify the X-Hub-Signature-256 HMAC Meta sends with each webhook POST.
// Returns true when no app secret is configured (so local dev still works),
// but you MUST set WHATSAPP_APP_SECRET in production.
export function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!env.whatsappAppSecret) {
    console.warn("WHATSAPP_APP_SECRET not set — skipping webhook signature check");
    return true;
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", env.whatsappAppSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Mark an inbound message read and show a typing indicator while we process it.
export async function markAsRead(messageId: string): Promise<void> {
  try {
    const res = await fetch(`${GRAPH}/${env.whatsappPhoneNumberId}/messages`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: { type: "text" },
      }),
    });
    if (!res.ok) console.error("markAsRead failed", await res.text());
  } catch (e) {
    console.error("markAsRead error", e);
  }
}

// POST a message payload and surface API errors (24h-window expiry, bad token,
// etc.) instead of silently swallowing them.
async function sendMessage(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${GRAPH}/${env.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`WhatsApp send failed (${res.status}): ${detail}`);
  }
}

export async function sendText(to: string, body: string): Promise<void> {
  await sendMessage({ to, type: "text", text: { body: body.slice(0, 4096) } });
}

export async function sendImageById(to: string, mediaId: string, caption?: string): Promise<void> {
  await sendMessage({
    to,
    type: "image",
    image: { id: mediaId, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
  });
}

export async function sendAudioById(to: string, mediaId: string): Promise<void> {
  await sendMessage({ to, type: "audio", audio: { id: mediaId } });
}

// Upload bytes to WhatsApp, returns a media id usable in a send call.
export async function uploadMedia(
  bytes: Uint8Array | Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), filename);
  const res = await fetch(`${GRAPH}/${env.whatsappPhoneNumberId}/media`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`uploadMedia failed: ${JSON.stringify(json)}`);
  return json.id as string;
}

// Download inbound media (voice notes, images) by media id.
export async function downloadMedia(
  mediaId: string
): Promise<{ bytes: Buffer; mimeType: string }> {
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: authHeaders() });
  const meta = await metaRes.json();
  if (!meta.url) throw new Error(`downloadMedia: no url for ${mediaId}`);
  const binRes = await fetch(meta.url, { headers: authHeaders() });
  const buf = Buffer.from(await binRes.arrayBuffer());
  return { bytes: buf, mimeType: meta.mime_type || "application/octet-stream" };
}

// Fetch an image from a public URL (Supabase storage) for re-upload to WhatsApp.
export async function fetchImage(url: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") || "image/jpeg";
  return { bytes: buf, mimeType };
}
