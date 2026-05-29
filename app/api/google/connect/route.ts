import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { setSetting, GOOGLE_OAUTH_STATE } from "@/lib/settings";

export const runtime = "nodejs";

// Admin starts the Google Calendar connect flow. Returns the Google consent URL
// (with an unguessable state we store) for the dashboard to redirect to.
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!env.googleClientId || !env.googleClientSecret) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set on the server" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const state = randomUUID();
  await setSetting(GOOGLE_OAUTH_STATE, state);

  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: `${origin}/api/google/callback`,
      response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/calendar.events",
      access_type: "offline",
      prompt: "consent",
      state,
    });

  return NextResponse.json({ url });
}
