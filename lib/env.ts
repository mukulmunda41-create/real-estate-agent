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

  sarvamApiKey: process.env.SARVAM_API_KEY!,

  whatsappToken: process.env.WHATSAPP_TOKEN!,
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "realestate_verify_token",
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || "",
  managerPhone: process.env.MANAGER_PHONE || "",

  cronSecret: process.env.CRON_SECRET || "",

  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};
