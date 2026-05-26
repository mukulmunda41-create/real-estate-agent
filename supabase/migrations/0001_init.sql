-- Real Estate AI Agent — initial schema
-- pgvector for property RAG
create extension if not exists vector;

-- ============================================================
-- PROPERTIES (knowledge base, embedded for semantic search)
-- ============================================================
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  property_type text,                 -- plot | villa | apartment | commercial ...
  city text,
  location text,
  bhk_config text,
  price text,                         -- human label e.g. "₹85 Lakh onwards"
  price_numeric numeric,              -- for filtering/sorting
  carpet_area text,
  possession text,
  amenities text[] default '{}',
  rera_id text,
  description text,
  image_urls text[] default '{}',
  content text,                       -- text blob that gets embedded
  embedding vector(1536),             -- OpenAI text-embedding-3-small
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists properties_embedding_idx
  on properties using hnsw (embedding vector_cosine_ops);
create index if not exists properties_city_idx on properties (city);

-- Semantic search over properties
create or replace function match_properties(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  name text,
  property_type text,
  city text,
  location text,
  bhk_config text,
  price text,
  carpet_area text,
  possession text,
  amenities text[],
  rera_id text,
  description text,
  image_urls text[],
  similarity float
)
language sql stable
as $$
  select
    p.id, p.name, p.property_type, p.city, p.location, p.bhk_config,
    p.price, p.carpet_area, p.possession, p.amenities, p.rera_id,
    p.description, p.image_urls,
    1 - (p.embedding <=> query_embedding) as similarity
  from properties p
  where p.embedding is not null
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- CRM: LEADS (replaces Google Sheets "Leads" tab)
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  wa_display_name text,
  properties_mentioned text[] default '{}',
  budget text,
  preferred_location text,
  bhk_config text,
  lead_type text,
  lead_status text,
  last_message text,
  last_interaction_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ============================================================
-- CRM: SITE VISITS (replaces Google Sheets "Site Visits" tab)
-- ============================================================
create table if not exists site_visits (
  id uuid primary key default gen_random_uuid(),
  lead_phone text,
  customer_name text,
  property text,
  visit_date text,
  visit_time text,
  status text default 'Scheduled',
  calendar_link text,
  created_at timestamptz default now()
);

-- ============================================================
-- CONVERSATION LOG (agent memory + live dashboard transcript)
-- ============================================================
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  role text not null,                 -- user | assistant
  msg_type text default 'text',       -- text | voice | image
  content text,
  transcript text,                    -- STT result for voice
  audio_url text,                     -- archived audio (signed)
  image_urls text[] default '{}',
  language_code text,
  created_at timestamptz default now()
);
create index if not exists messages_phone_idx on messages (phone, created_at);

-- ============================================================
-- AGENT ACTIVITY FEED (live "what the agent is doing")
-- ============================================================
create table if not exists agent_events (
  id uuid primary key default gen_random_uuid(),
  phone text,
  event_type text,                    -- received|stt|tool_call|llm|tts|sent|crm|alert|error
  label text,
  detail jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists agent_events_created_idx on agent_events (created_at desc);
