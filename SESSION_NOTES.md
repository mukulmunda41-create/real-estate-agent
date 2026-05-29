# Session Notes — Real Estate AI Agent

Running log of context, decisions, and TODOs across working sessions. Architecture lives in `CLAUDE.md`; this file is state + decisions + what's left.

---

## Project goal
WhatsApp AI sales agent ("Priya") + admin dashboard for Indian real estate firms. Intent: **sell / white-label** this to brokers/developers (SaaS or per-client). Core funnel works: qualify → recommend → book.

## Current state (as of last session, 2026-05-27)
- App runs locally (`npm run dev`, :3000). Tested live over WhatsApp via **ngrok**.
- Hosted Supabase project `oadlexjwylquzaoqzxau` — schema applied remotely (migrations 0001–0007). All 6 tables RLS-enabled.
- WhatsApp Cloud API webhook wired; verify token `realestate_verify_token`.
- **Chat model: `gpt-5.4-mini`** (switched from `gpt-4.1` on 2026-05-29). Reason below.

## Key decisions & rationale
- **gpt-5.4-mini over gpt-4.1** (2026-05-29): newer-gen mini, benchmarks *above* gpt-4.1 on instruction-following AND ~half the token cost (~$0.75/$4.50 vs $2/$8 per 1M). Tested on the rule-heavy persona/routing prompts via `test:agent`: Hindi intro+language ✅, concierge routing ✅, booking capture (no hallucination) ✅, data capture ✅, accepts `temperature` (no param error) ✅. One minor miss: on a pure requirement-dump first message it skipped the Priya intro / didn't auto-qualify. Net: same reliability as gpt-4.1, lower cost. NOTE: this is a different model from the old **gpt-4.1-mini**, which earlier followed the multi-rule prompts only ~70% (intro/language/handoff misses) — that finding does NOT apply to gpt-5.4-mini.
- **Concierge/FAQ agent added** (6th agent) — fills the gap where general/company questions and `booked` leads had no proper handler. Other proposed agents (Finance/Loan, Negotiation, Post-booking) deliberately deferred — not needed until a paying client asks (avoid over-building).
- **Priya persona**: introduces by name only on the first message, must reply in the customer's exact language, short/conversational WhatsApp tone. Must **NOT** say "sales team" or any department name (user disliked it).

## Hardening done this session
Webhook signature verification, message dedup (`processed_messages`), per-phone rate limiting, double-booking guard, WhatsApp send error handling, read receipt + typing indicator, Vercel `maxDuration`, hybrid RAG (city/price filters), real image vision, fixed duplicate-user-message in LLM context.

## Changes this session (2026-05-29)
- **Conversations page** added to dashboard (`/conversations`, nav under Properties). Per-customer full chat (text/voice/image) from the `messages` table, live via Realtime.
- **Voice: Sarvam → Gemini.** `lib/sarvam.ts` deleted; `lib/gemini.ts` does STT (`gemini-2.5-flash` audio understanding) + TTS (`gemini-2.5-flash-preview-tts`, voice **Aoede**). TTS returns PCM → encoded to MP3 with `@breezystack/lamejs` for WhatsApp.
- **Google Calendar (OAuth)** integrated in `book_site_visit` (`lib/google-calendar.ts`). Best-effort: creates an IST 1-hour event, stores `htmlLink` in `site_visits.calendar_link`. Booking still succeeds if calendar fails. Slot availability still read from Supabase.

## Schema: Tier-1 CRM/India fields (migration 0008, applied live 2026-05-29)
Additive, nullable/defaulted columns — nothing breaks.
- `leads`: `purpose` (**now wired** — agent gathered it but it wasn't persisted; fixed in `crm.ts`), `source` (default 'whatsapp'), `assigned_to`, `loan_required`, `budget_min/max`.
- `site_visits`: `visit_at` (timestamptz — **now wired** in `book_site_visit`, alongside text date/time), `outcome`, `notes`.
- `properties`: `status` (default 'available'), `transaction_type` (default 'sale'), `facing` (Vastu), `furnishing`, `price_per_sqft`, `construction_status`.
- **Wired in code:** `purpose`, `visit_at`. **Column-only for now** (fill via dashboard/seed/manual or wire later): `source`(auto-default), `assigned_to`, `loan_required`, `budget_min/max`, visit `outcome`/`notes`, all new `properties` fields.
- **Deferred (when selling SaaS):** `org_id` multi-tenant across tables, `sales_agents`/`users` table + FK links.

## New env vars required (add to `.env.local` AND Vercel)
- `GEMINI_API_KEY` — from Google AI Studio (aistudio.google.com → Get API key). Needed for voice (STT/TTS). Optional: `GEMINI_STT_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_VOICE` (default Aoede).
- Google Calendar (OAuth): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, optional `GOOGLE_CALENDAR_ID` (default `primary`). Get refresh token via Google Cloud Console OAuth client + OAuth Playground (scope `.../auth/calendar.events`). If unset, calendar push is silently skipped.
- `SARVAM_API_KEY` no longer used (safe to remove).

## TODO / open items
- [ ] Fill `WHATSAPP_APP_SECRET` in `.env.local` (Meta → App Settings → Basic) — until then webhook signature check is skipped.
- [ ] Set `OPENAI_CHAT_MODEL=gpt-4.1` in Vercel env when deploying (`.env.local` is gitignored, doesn't deploy).
- [ ] WhatsApp message **templates** for proactive follow-up/reactivation + manager alerts (free-form fails after the 24h window). Needs Meta approval.
- [ ] Push to GitHub (currently only committed locally).
- [ ] (When selling as SaaS) multi-tenant `org_id`, lock dashboard signups, summary-based long memory.

## Testing tips
- Agent core without WhatsApp: `npm run test:agent -- "message"` (use `STAGE=` to start mid-funnel).
- Fresh WhatsApp test for a number: clear its rows in `messages`/`agent_events`/`leads`/`site_visits` so the lead starts at `new` and Priya re-introduces.
- Dashboard at `localhost:3000` shows live agent activity (Concierge = Agent 4).
