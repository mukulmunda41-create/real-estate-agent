import OpenAI from "openai";
import { env } from "./env";

let _client: OpenAI | null = null;
export function openai(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: env.openaiApiKey });
  return _client;
}
