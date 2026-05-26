import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Allow either the cron secret (Vercel Cron / scheduler) or a logged-in admin.
export async function requireCronOrAdmin(req: Request): Promise<boolean> {
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (env.cronSecret && token === env.cronSecret) return true;
  const user = await requireUser(req);
  return !!user;
}

// Validate the Supabase Auth bearer token sent by the dashboard.
export async function requireUser(req: Request): Promise<{ id: string } | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id };
}
