-- Server-only table (written via service_role, which bypasses RLS). No client
-- should ever read it, so enable RLS with no policies to block anon/authenticated.
alter table public.processed_messages enable row level security;
