// Centralized environment access. Server-only secrets must not be imported
// into client components.

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  openaiApiKey: process.env.OPENAI_API_KEY!,
  openaiChatModel: process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini",
  openaiEmbeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",

  // Voice: Gemini handles STT (audio understanding) + TTS (voice "Aoede").
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiSttModel: process.env.GEMINI_STT_MODEL || "gemini-2.5-flash",
  geminiTtsModel: process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts",
  geminiVoice: process.env.GEMINI_VOICE || "Aoede",

  // Google Calendar (OAuth) — pushes a calendar event when a site visit is booked.
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN || "",
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID || "primary",

  whatsappToken: process.env.WHATSAPP_TOKEN!,
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "realestate_verify_token",
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || "",
  managerPhone: process.env.MANAGER_PHONE || "",

  cronSecret: process.env.CRON_SECRET || "",

  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};
