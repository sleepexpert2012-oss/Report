create table if not exists public.shopee_app_token (
  app_key text not null,
  shop_id bigint not null,
  access_token text not null,
  refresh_token text not null,
  expire_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (app_key, shop_id)
);

create table if not exists public.shopee_channel_fact (
  source text not null,
  fact_date date not null,
  entity_id text not null,
  dimensions jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (source, fact_date, entity_id)
);

create index if not exists shopee_channel_fact_source_date_idx
  on public.shopee_channel_fact (source, fact_date desc);

alter table public.shopee_app_token enable row level security;
alter table public.shopee_channel_fact enable row level security;

revoke all on public.shopee_app_token from anon, authenticated;
revoke all on public.shopee_channel_fact from anon, authenticated;
