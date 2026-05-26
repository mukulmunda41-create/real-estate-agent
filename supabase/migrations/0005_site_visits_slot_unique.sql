-- Prevent double-booking the same slot (ignores cancelled visits).
create unique index if not exists site_visits_slot_unique
  on site_visits (visit_date, visit_time)
  where status <> 'Cancelled';
