// Display formatters for the dashboard. Timestamps are stored in UTC; we render
// them in IST (the firm's timezone) with clean, uppercase AM/PM.

const IST = "Asia/Kolkata";

// "just now" / "3m ago" / "2h ago" — compact relative time for live feeds.
export function timeAgo(ts: string): string {
  const d = new Date(ts);
  if (isNaN(+d)) return "";
  const s = Math.max(0, Math.floor((Date.now() - +d) / 1000));
  if (s < 8) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// "4:30 PM" — clock time from an ISO timestamp.
export function clockTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(+d)) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST });
}

// "30 May" — short date from an ISO timestamp.
export function shortDate(ts: string): string {
  const d = new Date(ts);
  if (isNaN(+d)) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: IST });
}

// site_visits stores dates as "dd-MM-yyyy". Render as "Sat, 30 May 2026".
export function prettyVisitDate(d?: string | null): string {
  if (!d) return "—";
  const [dd, mm, yyyy] = d.split("-").map(Number);
  if (!dd || !mm || !yyyy) return d;
  const date = new Date(yyyy, mm - 1, dd);
  if (isNaN(+date)) return d;
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// Normalize a stored visit time to clean "4:00 PM". Accepts "4:00 PM", "4 pm",
// "16:00", etc.
export function prettyVisitTime(t?: string | null): string {
  if (!t) return "—";
  const s = t.trim();
  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i);
  if (ampm) {
    const h = Number(ampm[1]);
    const min = ampm[2] ?? "00";
    const suffix = ampm[3].toUpperCase() + "M";
    return `${h}:${min} ${suffix}`;
  }
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    let h = Number(h24[1]);
    const min = h24[2];
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${min} ${suffix}`;
  }
  return s;
}
