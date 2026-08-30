-- =====================================================================
-- Sleep Expert Dashboard — Supabase schema
-- Chạy toàn bộ file này trong Supabase → SQL Editor → New query → Run
-- Mô hình: lưu FILE dữ liệu thô đã import (dataset) + bản RAW đã tính (snapshot)
-- =====================================================================

-- 1) Bảng lưu dữ liệu thô mỗi lần import (main = SKU/Sales/Tồn kho ; ads = file ads riêng)
create table if not exists public.dataset (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('main','ads')),
  payload     jsonb not null,          -- nội dung các sheet đã đọc từ Excel
  rows_count  int,
  uploaded_by text,                    -- tên người import (tự nhập)
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists dataset_kind_created_idx on public.dataset (kind, created_at desc);

-- 2) Bảng lưu snapshot RAW đã tính — dashboard đọc bản MỚI NHẤT
create table if not exists public.snapshot (
  id          bigint generated always as identity primary key,
  payload     jsonb not null,          -- object RAW cho dashboard
  bytes       int,
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists snapshot_created_idx on public.snapshot (created_at desc);

-- 3) RLS — nội bộ tin cậy: ai có anon key cũng đọc & ghi được (không cần đăng nhập)
alter table public.dataset  enable row level security;
alter table public.snapshot enable row level security;

drop policy if exists dataset_read   on public.dataset;
drop policy if exists dataset_insert on public.dataset;
drop policy if exists snapshot_read   on public.snapshot;
drop policy if exists snapshot_insert on public.snapshot;

create policy dataset_read    on public.dataset  for select using (true);
create policy dataset_insert  on public.dataset  for insert with check (true);
create policy snapshot_read   on public.snapshot for select using (true);
create policy snapshot_insert on public.snapshot for insert with check (true);

-- 4) (Tùy chọn) View lấy nhanh bản mới nhất
create or replace view public.latest_snapshot as
  select payload, created_at, uploaded_by from public.snapshot order by created_at desc limit 1;

-- Xong. Vào Project Settings → API để lấy: Project URL và anon public key.
