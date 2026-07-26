create table if not exists public.shopee_api_fact (
  app_key text not null,
  module text not null,
  endpoint text not null,
  scope_key text not null default 'default',
  entity_id text not null,
  fact_date date,
  dimensions jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (app_key, endpoint, scope_key, entity_id)
);

create index if not exists shopee_api_fact_module_date_idx
  on public.shopee_api_fact (module, fact_date desc nulls last);

create index if not exists shopee_api_fact_endpoint_synced_idx
  on public.shopee_api_fact (endpoint, synced_at desc);

create table if not exists public.shopee_sync_checkpoint (
  app_key text not null,
  module text not null,
  endpoint text not null,
  scope_key text not null default 'default',
  cursor jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'complete', 'partial', 'error', 'blocked')),
  rows_synced bigint not null default 0,
  pages_synced integer not null default 0,
  data_through timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_retry_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  primary key (app_key, endpoint, scope_key)
);

create index if not exists shopee_sync_checkpoint_status_idx
  on public.shopee_sync_checkpoint (status, next_retry_at nulls first);

alter table public.shopee_api_fact enable row level security;
alter table public.shopee_sync_checkpoint enable row level security;

revoke all on public.shopee_api_fact from anon, authenticated;
revoke all on public.shopee_sync_checkpoint from anon, authenticated;

