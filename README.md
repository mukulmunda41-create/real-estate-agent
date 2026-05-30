# Priya — WhatsApp AI Sales Agent for Real Estate 🏙️

An autonomous **WhatsApp AI sales agent** ("Priya") for Indian real estate firms, plus a live **AI Command Center** admin dashboard. Customers chat on WhatsApp — by text, voice, or image, in English / Hindi / Hinglish / Marathi — and a multi-agent LLM pipeline qualifies them, recommends properties via semantic search, books site visits, and answers FAQs. Proactive cron jobs re-engage quiet and cold leads automatically.

> Built on **Next.js 16** (App Router + Turbopack), **React 19**, **Tailwind v4**, and **Supabase**.

---

## ✨ What it does

- **Conversational sales on WhatsApp** — text, voice notes (auto-transcribed), and images, in the customer's own language. Replies are short, human, and stay in the customer's language (Hindi voice → Hinglish reply).
- **Multi-agent pipeline** — six specialist agents collaborate per conversation: lead qualification → property recommendation → site-visit booking, with a concierge for FAQs and proactive follow-up / reactivation agents.
- **Property recommendations via RAG** — hybrid semantic + structured search over the property catalog (pgvector + city/price filters).
- **Site-visit booking** — double-booking-safe slots, optional Google Calendar sync.
- **Proactive re-engagement** — scheduled sweeps nudge engaged-but-quiet and cold leads.
- **Live admin dashboard** — a cinematic, real-time command center showing the agent pipeline, live conversations, KPIs, funnel, and activity feed, streamed straight from the database.

## 🧠 How it works

### Inbound message flow (the spine)

```
WhatsApp ─▶ /api/whatsapp/webhook ─▶ lib/handler.ts ─▶ orchestrator ─▶ runtime (per specialist) ─▶ tools
```

1. **Webhook** verifies Meta's signature, returns `200` instantly, and runs all work in the background.
2. **Handler** dedups messages, transcribes voice (Gemini), loads history, then runs the orchestrator.
3. **Orchestrator** picks the starting specialist from the lead's pipeline stage and follows in-turn hand-offs (e.g. qualify → recommend → book).
4. **Runtime** runs one specialist's tool-calling loop; each turn ends with a single structured `respond` call.
5. **Handler** sends the reply (text + optional voice), updates the lead, schedules the next follow-up, and alerts the manager on booking.

### The agents

| Agent | Role |
|---|---|
| `lead_qualification` | Captures city, budget, BHK, purpose |
| `property_recommendation` | Matches catalog via hybrid RAG |
| `site_visit_booking` | Checks slots & books visits |
| `concierge` | Company / general / process FAQs |
| `follow_up` | Re-engages engaged-but-quiet leads (proactive) |
| `reactivation` | Wins back cold leads, 7+ days (proactive) |

**Pipeline stages:** `new → qualifying → qualified → recommending → booking → booked` (plus `cold`).

### Memory

Two layers: the last ~20 messages feed the LLM each turn, while durable facts (budget, location, BHK, name, properties) live on the lead row and are re-injected every turn — so they survive far beyond the message window.

## 🏗️ Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Styling | Tailwind CSS v4, hand-rolled SVG/CSS charts & animations |
| Database | Supabase (Postgres + pgvector + Realtime + Auth) |
| LLM | OpenAI (chat `gpt-4.1` + embeddings) |
| Voice | Gemini (STT via audio understanding, TTS → MP3 for WhatsApp) |
| Messaging | WhatsApp Cloud API (Graph v21) |
| Calendar | Google Calendar (OAuth, optional) |
| Hosting | Vercel (cron via `vercel.json`) |

## 🚀 Getting started

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create a `.env.local` (see [Environment variables](#-environment-variables) below).

### 3. Seed the property catalog

```bash
npm run seed   # embeds + loads data/sample-properties.json into Supabase
```

### 4. Run the dev server

```bash
npm run dev    # http://localhost:3000  (dashboard at /dashboard)
```

The dashboard requires a Supabase Auth user — create one in your Supabase project, then log in at `/login`.

## 🧪 Commands

```bash
npm run dev          # Next dev server (Turbopack) on :3000
npm run build        # production build
npm run lint         # eslint
npm run seed         # embed + load sample properties into Supabase
npm run google:auth  # one-time Google Calendar OAuth (prints a refresh token)

# Exercise the agent end-to-end without WhatsApp/voice:
npm run test:agent -- "2 BHK in Pune under 80 lakh"

# Start the lead at a given stage, or override the model for one run:
STAGE=qualified npm run test:agent -- "show me something nice"
OPENAI_CHAT_MODEL=gpt-4.1 STAGE=booked npm run test:agent -- "..."
```

`test:agent` is the primary way to test agent logic — it calls the real orchestrator / OpenAI / Supabase but skips WhatsApp. There is no unit-test framework; verify behaviour with `test:agent` and by inspecting `agent_events` / `messages` in Supabase.

## 🔐 Environment variables

Set these in `.env.local` (local) and in your Vercel project settings (production).

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon key (used by dashboard under RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (server only — bypasses RLS) |
| `OPENAI_API_KEY` | ✅ | Chat + embeddings |
| `OPENAI_CHAT_MODEL` | — | Defaults to `gpt-4.1-mini`; **set to `gpt-4.1`** (mini is unreliable on the multi-rule prompts) |
| `OPENAI_EMBEDDING_MODEL` | — | Defaults to `text-embedding-3-small` |
| `GEMINI_API_KEY` | — | Voice (STT + TTS); without it, voice is disabled |
| `WHATSAPP_TOKEN` | ✅ | WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ | WhatsApp sender phone-number ID |
| `WHATSAPP_VERIFY_TOKEN` | — | Webhook verify token |
| `WHATSAPP_APP_SECRET` | — | Verifies inbound webhook signatures |
| `MANAGER_PHONE` | — | Receives booking alerts |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | — | Google Calendar sync (optional) |
| `GOOGLE_CALENDAR_ID` | — | Defaults to `primary` |
| `CRON_SECRET` | — | Authorizes Vercel Cron calls to the proactive routes |
| `NEXT_PUBLIC_APP_URL` | — | Public app URL (defaults to `http://localhost:3000`) |

All env access is centralized in `lib/env.ts` — add new variables there.

## 📁 Project layout

```
app/
  api/whatsapp/webhook/   # WhatsApp inbound webhook (the entry point)
  api/cron/{followup,reactivation}/  # proactive sweeps (scheduled in vercel.json)
  api/stats/              # dashboard KPIs
  dashboard/              # the live AI Command Center
  leads/ visits/ properties/ conversations/ settings/  # admin pages
lib/
  agents/                 # orchestrator, runtime, definitions, proactive sweeps
  tools.ts                # model-callable tools (search / calendar / booking) + RAG
  handler.ts              # inbound pipeline glue
  supabase.ts             # service-role admin client (server only)
  openai.ts gemini.ts whatsapp.ts google-calendar.ts   # external services
  env.ts                  # centralized env access
components/               # dashboard UI (AIOrchestratorHub, charts, shell, …)
supabase/migrations/      # schema (applied to the hosted project)
```

## 🌐 Deployment (Vercel)

Connected to GitHub — pushing to `main` triggers a production deploy; any other branch gets a preview deploy. Set all environment variables in the Vercel project settings, and point the WhatsApp webhook at `https://<your-domain>/api/whatsapp/webhook`. Proactive cron jobs are scheduled in `vercel.json`.

> **WhatsApp 24h window:** free-form messages are only allowed within 24h of the customer's last message. Proactive follow-ups / reactivations and manager alerts sent outside that window require pre-approved WhatsApp message templates.

---

Built with [Claude Code](https://claude.com/claude-code).
