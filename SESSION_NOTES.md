# Session Notes — Real Estate AI Agent

Running log of context, decisions, and TODOs across working sessions. Architecture lives in `CLAUDE.md`; this file is state + decisions + what's left.

---

## Project goal
WhatsApp AI sales agent ("Priya") + admin dashboard for Indian real estate firms. Intent: **sell / white-label** this to brokers/developers (SaaS or per-client). Core funnel works: qualify → recommend → book.

## Current state (as of last session, 2026-05-27)
- App runs locally (`npm run dev`, :3000). Tested live over WhatsApp via **ngrok**.
- Hosted Supabase project `oadlexjwylquzaoqzxau` — schema applied remotely (migrations 0001–0007). All 6 tables RLS-enabled.
- WhatsApp Cloud API webhook wired; verify token `realestate_verify_token`.
- **Chat model: `gpt-4.1`** (switched from `gpt-4.1-mini`). Reason below.

## Key decisions & rationale
- **gpt-4.1 over gpt-4.1-mini**: mini followed the multi-rule persona/routing prompts only ~70% of the time (concierge handoff missed, language slipped to English, intro inconsistent). gpt-4.1 was ~100% in tests. Quality > the ~5x cost (~₹5 vs ₹1 per conversation) for a sales agent.
- **Concierge/FAQ agent added** (6th agent) — fills the gap where general/company questions and `booked` leads had no proper handler. Other proposed agents (Finance/Loan, Negotiation, Post-booking) deliberately deferred — not needed until a paying client asks (avoid over-building).
- **Priya persona**: introduces by name only on the first message, must reply in the customer's exact language, short/conversational WhatsApp tone. Must **NOT** say "sales team" or any department name (user disliked it).

## Hardening done this session
Webhook signature verification, message dedup (`processed_messages`), per-phone rate limiting, double-booking guard, WhatsApp send error handling, read receipt + typing indicator, Vercel `maxDuration`, hybrid RAG (city/price filters), real image vision, fixed duplicate-user-message in LLM context.

## TODO / open items
- [ ] Fill `WHATSAPP_APP_SECRET` in `.env.local` (Meta → App Settings → Basic) — until then webhook signature check is skipped.
- [ ] Set `OPENAI_CHAT_MODEL=gpt-4.1` in Vercel env when deploying (`.env.local` is gitignored, doesn't deploy).
- [ ] WhatsApp message **templates** for proactive follow-up/reactivation + manager alerts (free-form fails after the 24h window). Needs Meta approval.
- [ ] Push to GitHub (currently only committed locally).
- [ ] (When selling as SaaS) multi-tenant `org_id`, lock dashboard signups, real Google Calendar integration, summary-based long memory.

## Testing tips
- Agent core without WhatsApp: `npm run test:agent -- "message"` (use `STAGE=` to start mid-funnel).
- Fresh WhatsApp test for a number: clear its rows in `messages`/`agent_events`/`leads`/`site_visits` so the lead starts at `new` and Priya re-introduces.
- Dashboard at `localhost:3000` shows live agent activity (Concierge = Agent 4).
