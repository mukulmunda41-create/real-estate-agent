import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  getSetting,
  setSetting,
  deleteSetting,
  GOOGLE_OAUTH_STATE,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_CALENDAR_ID,
  GOOGLE_CONNECTED_EMAIL,
} from "@/lib/settings";

export const runtime = "nodejs";

// Google redirects here after consent. Validates state, exchanges the code for a
// refresh token, stores it, then bounces back to the Settings page.
export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const origin = u.origin;
  const back = (status: string) => NextResponse.redirect(`${origin}/settings?google=${status}`);

  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  if (u.searchParams.get("error")) return back("error");

  const savedState = await getSetting(GOOGLE_OAUTH_STATE);
  if (!code || !state || !savedState || state !== savedState) return back("error");
  await deleteSetting(GOOGLE_OAUTH_STATE);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: `${origin}/api/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tok = await tokenRes.json();
  if (!tok.refresh_token) return back("noref"); // happens if consent didn't re-prompt; we force prompt=consent so this is rare

  let email = "";
  try {
    const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    email = (await ui.json()).email || "";
  } catch {
    /* email is display-only */
  }

  await setSetting(GOOGLE_REFRESH_TOKEN, tok.refresh_token);
  await setSetting(GOOGLE_CALENDAR_ID, "primary");
  await setSetting(GOOGLE_CONNECTED_EMAIL, email);
  return back("connected");
}
