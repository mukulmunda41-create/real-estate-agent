-- Idempotency: track processed WhatsApp message ids so retries aren't re-handled.
create table if not exists processed_messages (
  wa_message_id text primary key,
  created_at timestamptz default now()
);
create index if not exists processed_messages_created_idx on processed_messages (created_at);
