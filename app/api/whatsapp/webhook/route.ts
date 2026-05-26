import { after, NextRequest } from "next/server";
import { verifyWebhook, verifySignature } from "@/lib/whatsapp";
import { handleInbound, type Inbound } from "@/lib/handler";
import { logEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow the multi-agent pipeline to finish in after()

// Meta webhook verification
export async function GET(req: NextRequest) {
  const challenge = verifyWebhook(req.nextUrl.searchParams);
  if (challenge) return new Response(challenge, { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

type WaMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  audio?: { id: string };
  voice?: { id: string };
  image?: { id: string; caption?: string };
};
type WaContact = { wa_id: string; profile?: { name?: string } };

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("OK", { status: 200 });
  }

  const inbound: Inbound[] = [];
  try {
    const entries = (body as { entry?: unknown[] }).entry ?? [];
    for (const entry of entries) {
      const changes = (entry as { changes?: unknown[] }).changes ?? [];
      for (const change of changes) {
        const value = (change as { value?: { messages?: WaMessage[]; contacts?: WaContact[] } }).value;
        if (!value?.messages) continue;
        const contact = value.contacts?.[0];
        const waDisplayName = contact?.profile?.name || "";
        for (const m of value.messages) {
          const phone = m.from || contact?.wa_id || "";
          if (!phone) continue;
          const messageId = m.id;
          if (m.type === "text") {
            inbound.push({ phone, waDisplayName, messageId, type: "text", text: m.text?.body || "" });
          } else if (m.type === "audio" || m.type === "voice") {
            inbound.push({ phone, waDisplayName, messageId, type: "audio", mediaId: (m.audio || m.voice)?.id });
          } else if (m.type === "image") {
            inbound.push({ phone, waDisplayName, messageId, type: "image", text: m.image?.caption, mediaId: m.image?.id });
          }
        }
      }
    }
  } catch (e) {
    console.error("webhook parse error", e);
  }

  // Respond 200 fast; process after the response is sent.
  after(async () => {
    for (const msg of inbound) {
      try {
        await handleInbound(msg);
      } catch (e) {
        await logEvent(msg.phone, "error", "handleInbound failed", { error: String(e) });
      }
    }
  });

  return new Response("OK", { status: 200 });
}
