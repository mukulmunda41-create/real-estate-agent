-- Tier-1 CRM / India real-estate fields.
-- All nullable (or DB-defaulted) additive columns — no existing data/code breaks.

-- ===== LEADS =====
alter table leads add column if not exists purpose text;                 -- end-use | investment (agent already gathers this)
alter table leads add column if not exists source text default 'whatsapp'; -- whatsapp | website | 99acres | magicbricks | referral ...
alter table leads add column if not exists assigned_to text;             -- human salesperson who owns the lead
alter table leads add column if not exists loan_required boolean;        -- India: most buyers need a home loan
alter table leads add column if not exists budget_min numeric;           -- numeric range for filtering/reporting (text `budget` kept for display)
alter table leads add column if not exists budget_max numeric;

create index if not exists leads_source_idx on leads (source);

-- ===== SITE VISITS =====
alter table site_visits add column if not exists visit_at timestamptz;   -- proper datetime (text visit_date/visit_time kept for display/back-compat)
alter table site_visits add column if not exists outcome text;           -- visited | no_show | interested | not_interested | rescheduled
alter table site_visits add column if not exists notes text;

create index if not exists site_visits_visit_at_idx on site_visits (visit_at);

-- ===== PROPERTIES =====
alter table properties add column if not exists status text default 'available';     -- available | sold | hold
alter table properties add column if not exists transaction_type text default 'sale'; -- sale | rent | resale
alter table properties add column if not exists facing text;             -- India/Vastu: East | West | North | South ...
alter table properties add column if not exists furnishing text;         -- unfurnished | semi | fully
alter table properties add column if not exists price_per_sqft numeric;
alter table properties add column if not exists construction_status text; -- ready_to_move | under_construction
