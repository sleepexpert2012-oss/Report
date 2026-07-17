-- =====================================================================
-- Bảng lưu token Shopee (chạy 1 lần trong Supabase → SQL Editor → Run)
-- Chỉ Edge Function (service_role) mới đọc/ghi được — KHÔNG mở cho anon.
-- =====================================================================
create table if not exists public.shopee_token (
  shop_id        bigint primary key,
  access_token   text,
  refresh_token  text,
  expire_at      timestamptz,   -- thời điểm access_token hết hạn (~4h)
  updated_at     timestamptz default now()
);

-- Bật RLS và KHÔNG tạo policy nào -> anon/public không đọc được (bảo mật token).
alter table public.shopee_token enable row level security;

-- (tuỳ chọn) log mỗi lần đồng bộ để theo dõi
create table if not exists public.shopee_sync_log (
  id          bigint generated always as identity primary key,
  ran_at      timestamptz default now(),
  ok          boolean,
  orders      int,
  rows        int,
  message     text
);
alter table public.shopee_sync_log enable row level security;
