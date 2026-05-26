-- Multi-agent system: lead pipeline stage + per-event agent tag

alter table leads
  add column if not exists stage text default 'new',         -- new|qualifying|qualified|recommending|booking|booked|cold
  add column if not exists last_inbound_at timestamptz,
  add column if not exists next_followup_at timestamptz,
  add column if not exists followup_count int default 0,
  add column if not exists reactivation_count int default 0;

alter table agent_events add column if not exists agent text;  -- which specialist agent emitted the event

create index if not exists leads_stage_idx on leads (stage);
create index if not exists leads_followup_idx on leads (next_followup_at);
