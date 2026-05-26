-- Hybrid search: vector similarity + optional structured filters (city, max price).
create or replace function match_properties(
  query_embedding vector(1536),
  match_count int default 5,
  filter_city text default null,
  max_price numeric default null
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
    and (filter_city is null or p.city ilike '%' || filter_city || '%')
    and (max_price is null or p.price_numeric is null or p.price_numeric <= max_price)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
