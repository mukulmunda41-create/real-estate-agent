import { supabaseAdmin } from "./supabase";

// Server-only key-value settings (app_settings table). Used for secrets like the
// Google Calendar refresh token that a firm connects from the dashboard.
export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  await supabaseAdmin()
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

export async function deleteSetting(key: string): Promise<void> {
  await supabaseAdmin().from("app_settings").delete().eq("key", key);
}

// Setting keys
export const GOOGLE_REFRESH_TOKEN = "google_refresh_token";
export const GOOGLE_CALENDAR_ID = "google_calendar_id";
export const GOOGLE_CONNECTED_EMAIL = "google_connected_email";
export const GOOGLE_OAUTH_STATE = "google_oauth_state";
