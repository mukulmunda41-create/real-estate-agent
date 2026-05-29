import { env } from "./env";
import { getSetting, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID } from "./settings";

// The OAuth refresh token / calendar id can be set two ways:
//  1) connected from the dashboard (stored in app_settings) — preferred, lets a
//     firm self-connect their Google account, and
//  2) env vars (GOOGLE_REFRESH_TOKEN / GOOGLE_CALENDAR_ID) — fallback.
async function getRefreshToken(): Promise<string> {
  return (await getSetting(GOOGLE_REFRESH_TOKEN)) || env.googleRefreshToken || "";
}
async function getCalendarId(): Promise<string> {
  return (await getSetting(GOOGLE_CALENDAR_ID)) || env.googleCalendarId || "primary";
}

// Whether Google Calendar is connected. If not, booking still works — we just
// skip pushing an event (the site_visits row remains the source of truth).
export async function calendarConfigured(): Promise<boolean> {
  if (!env.googleClientId || !env.googleClientSecret) return false;
  return Boolean(await getRefreshToken());
}

// Exchange the long-lived refresh token for a short-lived access token.
export async function getAccessToken(refreshToken?: string): Promise<string> {
  const rt = refreshToken || (await getRefreshToken());
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      refresh_token: rt,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Google token refresh failed: ${JSON.stringify(json)}`);
  }
  return json.access_token as string;
}

// Build IST (Asia/Kolkata, +05:30) RFC3339 start/end (1-hour slot) from the
// agent's date ("dd-MM-yyyy") and time ("hh:mm AM/PM").
export function istWindow(visitDate: string, visitTime: string): { start: string; end: string } {
  const [dd, mm, yyyy] = visitDate.split("-").map((s) => s.trim());
  const m = visitTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!dd || !mm || !yyyy || !m) throw new Error(`Bad date/time: ${visitDate} ${visitTime}`);

  let hour = parseInt(m[1], 10) % 12;
  if (/PM/i.test(m[3])) hour += 12;
  const startH = String(hour).padStart(2, "0");
  const endH = String((hour + 1) % 24).padStart(2, "0");
  const date = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  return {
    start: `${date}T${startH}:${m[2]}:00+05:30`,
    end: `${date}T${endH}:${m[2]}:00+05:30`,
  };
}

export type CalendarEvent = { id: string; link: string };

type EventOpts = { summary: string; description: string; visitDate: string; visitTime: string };

function eventBody(opts: EventOpts) {
  const { start, end } = istWindow(opts.visitDate, opts.visitTime);
  return {
    summary: opts.summary,
    description: opts.description,
    start: { dateTime: start, timeZone: "Asia/Kolkata" },
    end: { dateTime: end, timeZone: "Asia/Kolkata" },
  };
}

// Create a site-visit event on the connected Google Calendar.
// Returns { id, link }, or empty strings if calendar isn't connected.
export async function createCalendarEvent(opts: EventOpts): Promise<CalendarEvent> {
  if (!(await calendarConfigured())) return { id: "", link: "" };
  const token = await getAccessToken();
  const calendarId = await getCalendarId();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(eventBody(opts)),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Calendar event create failed: ${JSON.stringify(json)}`);
  return { id: (json.id as string) || "", link: (json.htmlLink as string) || "" };
}

// Update an existing calendar event's time/details (used when a visit is edited).
export async function updateCalendarEvent(eventId: string, opts: EventOpts): Promise<CalendarEvent> {
  if (!eventId || !(await calendarConfigured())) return { id: eventId, link: "" };
  const token = await getAccessToken();
  const calendarId = await getCalendarId();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(eventBody(opts)),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Calendar event update failed: ${JSON.stringify(json)}`);
  return { id: (json.id as string) || eventId, link: (json.htmlLink as string) || "" };
}

// Delete a calendar event (used when a visit is cancelled). Best-effort.
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (!eventId || !(await calendarConfigured())) return;
  const token = await getAccessToken();
  const calendarId = await getCalendarId();
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
}
