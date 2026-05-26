-- RLS, Realtime publication, and storage buckets

-- ============================================================
-- RLS — admin dashboard reads as authenticated; server writes via service_role (bypasses RLS)
-- ============================================================
alter table properties    enable row level security;
alter table leads         enable row level security;
alter table site_visits   enable row level security;
alter table messages      enable row level security;
alter table agent_events  enable row level security;

-- authenticated (logged-in admin) can read everything
create policy "auth read properties"   on properties   for select to authenticated using (true);
create policy "auth read leads"         on leads        for select to authenticated using (true);
create policy "auth read site_visits"   on site_visits  for select to authenticated using (true);
create policy "auth read messages"      on messages     for select to authenticated using (true);
create policy "auth read agent_events"  on agent_events for select to authenticated using (true);

-- ============================================================
-- Realtime — stream inserts/updates to the live dashboard
-- ============================================================
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table agent_events;
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table site_visits;

-- ============================================================
-- Storage buckets
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('property-images', 'property-images', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('voice-notes', 'voice-notes', false)
  on conflict (id) do nothing;

-- Public read for property images (so WhatsApp/clients can fetch by URL)
create policy "public read property images"
  on storage.objects for select
  using (bucket_id = 'property-images');
