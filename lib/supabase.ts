import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// Server-side admin client (service role) — bypasses RLS. NEVER import into
// client components.
let _admin: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
