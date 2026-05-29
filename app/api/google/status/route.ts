import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getSetting, GOOGLE_REFRESH_TOKEN, GOOGLE_CONNECTED_EMAIL } from "@/lib/settings";

export const runtime = "nodejs";

// Connection status for the Settings page. Never returns the token itself.
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const dbToken = await getSetting(GOOGLE_REFRESH_TOKEN);
  const email = await getSetting(GOOGLE_CONNECTED_EMAIL);
  return NextResponse.json({
    serverConfigured: Boolean(env.googleClientId && env.googleClientSecret),
    connected: Boolean(dbToken || env.googleRefreshToken),
    email: email || "",
    viaEnv: !dbToken && Boolean(env.googleRefreshToken),
  });
}
