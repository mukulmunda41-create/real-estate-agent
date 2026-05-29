import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteSetting, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID, GOOGLE_CONNECTED_EMAIL } from "@/lib/settings";

export const runtime = "nodejs";

// Admin disconnects Google Calendar (clears the stored token). Note: an env
// fallback token, if set, will still apply.
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await deleteSetting(GOOGLE_REFRESH_TOKEN);
  await deleteSetting(GOOGLE_CALENDAR_ID);
  await deleteSetting(GOOGLE_CONNECTED_EMAIL);
  return NextResponse.json({ ok: true });
}
