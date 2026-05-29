-- Store the Google Calendar event id (not just the htmlLink) so dashboard edits
-- can update or delete the corresponding calendar event instead of orphaning it.
alter table site_visits add column if not exists calendar_event_id text;
