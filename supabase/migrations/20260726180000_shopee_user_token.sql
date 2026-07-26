alter table public.shopee_app_token
  add column if not exists user_id bigint;

create index if not exists shopee_app_token_user_idx
  on public.shopee_app_token (app_key, user_id);
