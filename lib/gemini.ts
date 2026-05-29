import lamejs from "@breezystack/lamejs";
import { env } from "./env";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GenPart = { text?: string; inlineData?: { data?: string }; inline_data?: { data?: string } };
type GenResponse = { candidates?: { content?: { parts?: GenPart[] } }[] };

async function generate(model: string, body: unknown): Promise<GenResponse> {
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": env.geminiApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini ${model} failed: ${JSON.stringify(json)}`);
  return json as GenResponse;
}

// Speech-to-text + language detection via a multimodal Gemini model.
// WhatsApp voice notes arrive as audio/ogg (opus), which Gemini accepts directly.
export async function stt(
  bytes: Buffer,
  mimeType: string,
  _filename: string
): Promise<{ transcript: string; languageCode: string }> {
  const mime = mimeType.split(";")[0].trim() || "audio/ogg";
  const json = await generate(env.geminiSttModel, {
    contents: [
      {
        parts: [
          {
            text:
              "Transcribe this voice note exactly as spoken, verbatim, in its original language and script. " +
              "Also detect the BCP-47 language code (e.g. hi-IN, en-IN, mr-IN). " +
              'Respond ONLY as JSON: {"transcript": "...", "language_code": "..."}.',
          },
          { inline_data: { mime_type: mime, data: bytes.toString("base64") } },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  });

  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  let transcript = "";
  let languageCode = "hi-IN";
  try {
    const parsed = JSON.parse(raw);
    transcript = String(parsed.transcript || "").trim();
    languageCode = String(parsed.language_code || "hi-IN").trim();
  } catch {
    transcript = raw.trim(); // fall back to raw text if it wasn't valid JSON
  }
  return { transcript, languageCode };
}

// Decode signed 16-bit little-endian mono PCM into Int16 samples.
function pcmToSamples(pcm: Buffer): Int16Array {
  const even = pcm.length - (pcm.length % 2);
  const ab = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + even);
  return new Int16Array(ab);
}

// Encode 24kHz mono PCM to MP3 (WhatsApp-compatible: audio/mpeg).
function pcmToMp3(pcm: Buffer, sampleRate = 24000): Buffer {
  const samples = pcmToSamples(pcm);
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const chunks: Buffer[] = [];
  const blockSize = 1152;
  for (let i = 0; i < samples.length; i += blockSize) {
    const block = samples.subarray(i, i + blockSize);
    const buf = encoder.encodeBuffer(block);
    if (buf.length) chunks.push(Buffer.from(buf));
  }
  const end = encoder.flush();
  if (end.length) chunks.push(Buffer.from(end));
  return Buffer.concat(chunks);
}

// Text-to-speech (Gemini TTS, voice "Aoede") → MP3 buffer.
// languageCode is accepted for signature compatibility; Gemini TTS infers
// language from the text itself, so it isn't sent to the API.
export async function tts(text: string, _languageCode = "hi-IN"): Promise<Buffer> {
  const json = await generate(env.geminiTtsModel, {
    contents: [{ parts: [{ text: text.slice(0, 2400) }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: env.geminiVoice } },
      },
    },
  });

  const part = json.candidates?.[0]?.content?.parts?.[0];
  const b64 = part?.inlineData?.data || part?.inline_data?.data || "";
  if (!b64) throw new Error("Gemini TTS returned no audio");
  return pcmToMp3(Buffer.from(b64, "base64"));
}
