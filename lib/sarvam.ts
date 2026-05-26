import { env } from "./env";

const BASE = "https://api.sarvam.ai";

// Speech-to-text with automatic language detection (saarika:v2.5).
export async function stt(
  bytes: Buffer,
  mimeType: string,
  filename: string
): Promise<{ transcript: string; languageCode: string }> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), filename);
  form.append("model", "saarika:v2.5");
  form.append("language_code", "unknown"); // auto-detect

  const res = await fetch(`${BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": env.sarvamApiKey },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Sarvam STT failed: ${JSON.stringify(json)}`);
  return {
    transcript: json.transcript || "",
    languageCode: json.language_code || "hi-IN",
  };
}

// Text-to-speech (bulbul:v3) → MP3 buffer (WhatsApp-compatible: audio/mpeg).
export async function tts(text: string, languageCode = "hi-IN"): Promise<Buffer> {
  const res = await fetch(`${BASE}/text-to-speech`, {
    method: "POST",
    headers: {
      "api-subscription-key": env.sarvamApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: text.slice(0, 2400),
      target_language_code: languageCode,
      model: "bulbul:v3",
      speaker: "priya",
      output_audio_codec: "mp3",
      speech_sample_rate: 22050,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Sarvam TTS failed: ${JSON.stringify(json)}`);
  const b64: string = json.audios?.[0] || json.audio || "";
  if (!b64) throw new Error("Sarvam TTS returned no audio");
  return Buffer.from(b64, "base64");
}
