-- Key-value app settings (server-only). Stores secrets like the Google Calendar
-- refresh token so a firm can self-connect from the dashboard instead of env.
create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- Server-only (written/read via service_role, which bypasses RLS). Enable RLS
-- with NO policies so anon/authenticated clients can never read the tokens.
alter table app_settings enable row level security;
