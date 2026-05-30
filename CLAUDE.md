# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The import above is load-bearing: this repo runs **Next.js 16 (App Router, Turbopack)**, which has breaking changes vs. older Next.js. Read `node_modules/next/dist/docs/` before writing framework code.

## What this is

A WhatsApp AI sales agent for an Indian real estate firm (persona: **"Priya"**) plus a live admin dashboard. Customers chat on WhatsApp (text / voice / image, in English/Hindi/Hinglish/Marathi); a multi-agent LLM pipeline qualifies them, recommends properties via RAG, books site visits, and answers FAQs. Proactive cron jobs re-engage quiet/cold leads.

## Commands

```bash
npm run dev          # Next dev server (Turbopack) on :3000
npm run build        # production build
npm run lint         # eslint
npm run seed         # embed + load data/sample-properties.json into Supabase (scripts/seed-properties.ts)
npm run test:agent -- "message"   # exercise the agent core end-to-end (no WhatsApp/Sarvam)
```

`test:agent` is the primary way to test agent logic. It calls the real orchestrator/OpenAI/Supabase but skips WhatsApp. Useful flags:

```bash
STAGE=qualified npm run test:agent -- "2 BHK in Pune under 80 lakh"   # start the lead at a given pipeline stage
OPENAI_CHAT_MODEL=gpt-4.1 STAGE=booked npm run test:agent -- "..."     # override model for a run (dotenv does NOT override shell env)
```

There is no unit-test framework; verify behaviour with `test:agent` and by inspecting `agent_events`/`messages` in Supabase.

## Inbound message flow (the spine)

`app/api/whatsapp/webhook/route.ts` → `lib/handler.ts` → `lib/agents/orchestrator.ts` → `lib/agents/runtime.ts` (per specialist) → `lib/tools.ts`.

1. **Webhook** verifies Meta's `X-Hub-Signature-256` (HMAC over raw body), parses messages, returns `200` immediately, and does all real work in Next's `after()` so WhatsApp doesn't retry.
2. **handler** dedups by WhatsApp message id (`processed_messages` table), marks read + shows typing, rate-limits per phone, transcribes voice (Gemini) / base64-encodes images, loads history, then calls `orchestrate`. It loads `recentHistory` **before** logging the current turn so the live message isn't duplicated in the LLM context.
3. **orchestrator** picks the starting specialist from the lead's `stage`, runs it, and follows in-turn `handoff_to` up to 3 hops (e.g. qualify → recommend → book). A self-handoff guard prevents an agent looping to itself.
4. **runtime** runs one specialist's tool-calling loop. Every specialist must end its turn by calling the shared `respond` tool exactly once — that single call carries both the customer-facing `message` and all structured fields (budget, stage flags, `handoff_to`, etc.). `normalize()` defensively coerces/validates that output.
5. **handler** then sends images, an optional voice reply (only when input was voice), the text reply, upserts the lead + schedules the next follow-up, and alerts the manager on booking.

## Multi-agent design

- Six agents defined in `lib/agents/definitions.ts`: `lead_qualification`, `property_recommendation`, `site_visit_booking`, `concierge` (general/company FAQ), `follow_up`, `reactivation` (last two are proactive-only).
- All share a `common()` prompt block carrying the Priya persona rules: introduce by name only on the first turn, **reply in the customer's exact language**, keep replies short/conversational, and **route general/company/process questions to `concierge` via `handoff_to`** instead of answering them.
- **Pipeline stages** (`leads.stage`): `new → qualifying → qualified → recommending → booking → booked`, plus `cold`. `agentForStage` maps stage→starting agent; `nextStage` advances it. `booked` routes to `concierge` (not back into recommendation).
- **Memory is two-layer**: raw conversation = last ~20 `messages` rows fed to the LLM each turn; durable facts (budget, location, BHK, purpose, properties, name) live on the `leads` row and are re-injected every turn via `sharedNote()` / the orchestrator's `merge()`, so they survive past the 20-message window.

**Adding/changing an agent touches 4 files in lockstep**: `lib/agents/types.ts` (`AgentName`, `AGENT_LABELS`, `AGENT_ORDER`, `HandoffTarget`), `lib/agents/definitions.ts` (`AGENT_DEFS`, and `common()` if it's a handoff target), `lib/agents/runtime.ts` (the `respond` tool's `handoff_to` enum + `normalize()` validation list), and `lib/agents/orchestrator.ts` (`agentForStage` / handoff-follow guard). For dashboard visibility, also add it to the `AGENTS` array in `components/AIOrchestratorHub.tsx`.

## Tools & RAG

`lib/tools.ts` defines the three model-callable tools (`search_properties`, `check_calendar`, `book_site_visit`) and executes them. `search_properties` is **hybrid RAG**: it embeds the query (OpenAI) and calls the `match_properties` Postgres RPC, which combines pgvector cosine similarity with optional structured filters (`filter_city`, `max_price` against `properties.price_numeric`). `book_site_visit` guards against double-booking (pre-check + a unique partial index on `site_visits(visit_date, visit_time)`) and, if Google Calendar is configured (`lib/google-calendar.ts`, OAuth refresh token), pushes a calendar event and stores its link in `site_visits.calendar_link` (best-effort — booking still succeeds if the calendar call fails). Slot availability (`check_calendar`) is still read from Supabase, the source of truth.

## Data & external services

- **Supabase** is the only datastore. `lib/supabase.ts` exposes a service-role admin client used by all server code — it **bypasses RLS** and must never be imported into client components. The dashboard reads via the anon client (`lib/supabase-browser.ts`) under RLS (`authenticated` can read; server writes via service role). Realtime streams `messages`/`agent_events`/`leads`/`site_visits` to the dashboard.
- **Schema** lives in `supabase/migrations/` but is applied to the **hosted** Supabase project (via the Supabase MCP/dashboard), not a local stack. Keep migration files in sync when you change schema remotely.
- `lib/env.ts` centralizes all env access — add new env vars here. Secrets live in `.env.local` (gitignored); `OPENAI_CHAT_MODEL` is set there (currently `gpt-4.1` — `gpt-4.1-mini` was unreliable at following the multi-rule prompts).
- **OpenAI** (`lib/openai.ts`): chat + embeddings. **Gemini** (`lib/gemini.ts`): STT via audio understanding (`gemini-2.5-flash`) + TTS (`gemini-2.5-flash-preview-tts`, voice "Aoede"); TTS returns 24kHz 16-bit PCM which is encoded to MP3 (`@breezystack/lamejs`) for WhatsApp. **WhatsApp Cloud API** (`lib/whatsapp.ts`): Graph v21; all sends check `res.ok` and throw on failure.

## Dashboard (admin UI)

Every page under `app/` except `/login` is a **client component** whose content is wrapped in `components/DashboardShell.tsx` — the auth gate. The shell calls Supabase Auth `getSession()`, redirects to `/login` if absent, and renders the sidebar + header; root `/` just `redirect()`s to `/dashboard`. `/dashboard` is the live command center; `/leads`, `/visits`, `/properties`, `/conversations`, `/settings` are the operational pages.

**Live data reaches the browser two ways**, both via the anon client (`lib/supabase-browser.ts`) under RLS (`authenticated` may read):
- `lib/use-realtime.ts` — `useRealtime(table)` does an initial fetch then streams inserts/updates via Supabase Realtime. **Gotcha:** Realtime enforces RLS, so the socket must carry the user JWT (`sb.realtime.setAuth(token)`) **before** `subscribe()` or `postgres_changes` deliver nothing (looks like a stale dashboard). The effect also bails out of subscribing if it was already torn down (React StrictMode double-mount) to avoid a "cannot add postgres_changes callbacks after subscribe()" crash.
- `lib/use-stats.ts` — polls `app/api/stats/route.ts` every 10s for derived KPIs/funnel/heatmap/lead-mix, all computed server-side from `leads`/`messages`/`site_visits`. Dashboard-facing API routes (`/api/stats`, `/api/visits`, `/api/properties`, `/api/google/*`) authorize with the Supabase bearer token via `lib/auth.ts` (`requireUser` / `requireCronOrAdmin`).

**The orchestration hub** (`components/AIOrchestratorHub.tsx`) is the centerpiece: it derives each agent's live state (active/processing/waiting/idle) from recent `agent_events` rows (`event_type === "llm"` within time windows) and renders the canvas reactor (`HoloBrain` brain + `ParticleField` sparks), SVG connector lines with animated data packets, and per-agent operational cards. `lib/events.ts::logEvent` is what populates `agent_events` from the server pipeline — the dashboard is a read-only mirror of that feed.

Charts are hand-rolled **pure SVG/CSS** in `components/charts.tsx` (no charting library). All motion lives in `app/globals.css` as a keyframe/utility system (reactor glow, flowing connectors, glass sheen, pointer-tracked card glow) and honors `prefers-reduced-motion`. Note `components/AgentPipeline.tsx` and `RobotAvatar.tsx` are **legacy** — superseded by `AIOrchestratorHub` and no longer rendered.

## Proactive agents & cron

`lib/agents/proactive.ts` runs follow-up (engaged-but-quiet leads) and reactivation (cold 7+ days) sweeps, exposed at `app/api/cron/{followup,reactivation}/route.ts` and scheduled in `vercel.json`. Cron routes authorize via `CRON_SECRET` bearer **or** a logged-in admin (`lib/auth.ts`). The dashboard can trigger a sweep manually.

**Known platform constraint:** WhatsApp only allows free-form messages within 24h of the customer's last message. Proactive follow-ups/reactivations and manager alerts sent after that window require pre-approved message templates (not yet implemented) — sends will fail (now surfaced, since `whatsapp.ts` throws on non-OK responses).
