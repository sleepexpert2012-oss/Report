-- ============================================================================
-- Data App v2 · Tầng kho cho master data
-- Chạy trong Supabase → SQL Editor → New query → Run
--
-- AN TOÀN: mọi bảng đều mang tiền tố v2_ nên KHÔNG đụng tới bảng nào của app
-- đang chạy. Đặc biệt, bảng `dim_brand` hiện có (đang chứa danh sách nhà cung
-- cấp) được giữ nguyên; bản mới nằm ở `v2_dim_brand` và `v2_dim_supplier`.
--
-- Chạy lại được nhiều lần: mọi lệnh đều "if not exists".
-- Muốn gỡ sạch: xem khối DROP ở cuối file (đang bị chú thích).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. LÔ NẠP — mỗi lần nạp một file là một lô
--    Giữ toàn bộ lịch sử: so được lô mới với lô cũ, và lùi lại được nếu nạp nhầm.
-- ---------------------------------------------------------------------------
create table if not exists public.v2_nap_lo (
  id           bigint generated always as identity primary key,
  nguon        text        not null,          -- tên file Excel đã nạp
  hop_dong     text        not null,          -- hợp đồng dữ liệu đã dùng
  bam_file     text,                          -- SHA-256 của file, để phát hiện nạp trùng
  so_dong_doc  int         not null default 0,
  so_dong_nhan int         not null default 0,
  so_dong_loai int         not null default 0,
  bao_cao      jsonb,                         -- toàn bộ báo cáo nạp, giữ để truy vết
  nguoi_nap    text,
  ghi_chu      text,
  dang_dung    boolean     not null default false,  -- lô mà app đang đọc
  tao_luc      timestamptz not null default now()
);

comment on table public.v2_nap_lo is
  'Mỗi lần nạp file master là một lô. Chỉ một lô có dang_dung = true tại một thời điểm.';

-- Chỉ cho phép đúng MỘT lô đang dùng. Đây là chốt chặn ở tầng database,
-- không phụ thuộc vào việc code nhớ hay quên.
create unique index if not exists v2_nap_lo_mot_lo_dang_dung
  on public.v2_nap_lo ((dang_dung)) where dang_dung;

-- ---------------------------------------------------------------------------
-- 2. BRAND — thương hiệu tiêu dùng
--    TÁCH HẲN khỏi nhà cung cấp. Đây chính là chỗ bản cũ làm sai: bảng
--    `dim_brand` cũ được nạp nhầm bằng sheet Dim_NCC.
-- ---------------------------------------------------------------------------
create table if not exists public.v2_dim_brand (
  lo_id   bigint not null references public.v2_nap_lo(id) on delete cascade,
  brand   text   not null,
  so_sku  int    not null default 0,
  primary key (lo_id, brand)
);

comment on table public.v2_dim_brand is
  'Thương hiệu tiêu dùng (TUFT & NEEDLE, POWER X). KHÔNG phải nhà cung cấp.';

-- ---------------------------------------------------------------------------
-- 3. NHÀ CUNG CẤP
-- ---------------------------------------------------------------------------
create table if not exists public.v2_dim_supplier (
  lo_id          bigint not null references public.v2_nap_lo(id) on delete cascade,
  supplier_code  text   not null,
  supplier_name  text   not null,
  lead_time_nguon text,                  -- ghi NGUYÊN VĂN từ file: có ô ghi "15-20"
  lead_time_ngay  int,                   -- số ngày đã quy đổi — tầng chuẩn hoá điền, tầng nạp để trống
  moq             int,
  payment_terms   int,                   -- số ngày công nợ
  giao_hang      text,                   -- Nội địa / Quốc tế
  dia_diem       text,
  so_sku         int not null default 0,
  primary key (lo_id, supplier_code)
);

comment on column public.v2_dim_supplier.lead_time_nguon is
  'Nguyên văn ô lead time trong file. Có nhà cung cấp ghi dạng khoảng ("15-20") nên không ép kiểu số ở tầng nạp.';
comment on column public.v2_dim_supplier.lead_time_ngay is
  'Số ngày đã quy đổi từ lead_time_nguon. Tầng chuẩn hoá điền, tầng nạp luôn để trống.';

-- ---------------------------------------------------------------------------
-- 4. SKU — danh mục sản phẩm
--    Khoá gồm cả lo_id nên mỗi lô giữ được bản đầy đủ của chính nó.
-- ---------------------------------------------------------------------------
create table if not exists public.v2_dim_sku (
  lo_id             bigint not null references public.v2_nap_lo(id) on delete cascade,
  sku               text   not null,
  ma_san_pham       text,
  category          text,
  nganh_hang        text,
  subcategory_code  text,
  subcategory_name  text,
  brand             text,
  supplier_code     text,
  supplier_name     text,
  shopee_item_id    text,
  variation_code    text,
  variation_name    text,
  ten_san_pham      text,
  vat_lieu_chinh    text,
  cao               text,          -- chuỗi: gối contour ghi "8/10", hai gờ cao thấp khác nhau
  rong              numeric,
  dai               numeric,
  net_weight        numeric,
  gross_weight      numeric,
  dong_goi          text,
  mau               text,
  min_order         int,
  leadtime          int,
  unit_cost_usd     numeric,
  unit_cost_vnd     numeric,
  gia_von_vat       numeric,
  sales_price_vnd   numeric,
  abc_class         text,
  m3                numeric,
  primary key (lo_id, sku)
);

create index if not exists v2_dim_sku_brand_idx    on public.v2_dim_sku (lo_id, brand);
create index if not exists v2_dim_sku_nganh_idx    on public.v2_dim_sku (lo_id, nganh_hang);
create index if not exists v2_dim_sku_supplier_idx on public.v2_dim_sku (lo_id, supplier_code);

-- ---------------------------------------------------------------------------
-- 5. VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU
--    Vòng đối chiếu: mã bán ra mà không có trong master thì phải hiện lên,
--    không được im lặng bỏ qua như app cũ.
-- ---------------------------------------------------------------------------
create table if not exists public.v2_dq_van_de (
  id          bigint generated always as identity primary key,
  loai        text not null,        -- 'sku_ban_ra_thieu_master' | 'ma_combo' | ...
  khoa        text not null,        -- mã SKU hoặc khoá của vấn đề
  mo_ta       text not null,
  gmv_treo    numeric,              -- số tiền đang bị treo vì vấn đề này
  bang_chung  jsonb,
  trang_thai  text not null default 'mo'  check (trang_thai in ('mo','da_xu_ly','bo_qua')),
  phat_hien   timestamptz not null default now(),
  dong_luc    timestamptz,
  unique (loai, khoa)
);

comment on table public.v2_dq_van_de is
  'Sổ vấn đề dữ liệu. Màn Cảnh báo đọc bảng SỐNG này, không đọc mảng đông cứng trong snapshot.';

-- ---------------------------------------------------------------------------
-- 6. KHUNG NHÌN — app luôn đọc qua đây, không đọc thẳng bảng
--    Đổi lô đang dùng thì app đổi theo ngay, không phải sửa code.
-- ---------------------------------------------------------------------------
create or replace view public.v2_sku_hien_hanh as
  select s.* from public.v2_dim_sku s
  join public.v2_nap_lo l on l.id = s.lo_id and l.dang_dung;

create or replace view public.v2_brand_hien_hanh as
  select b.* from public.v2_dim_brand b
  join public.v2_nap_lo l on l.id = b.lo_id and l.dang_dung;

create or replace view public.v2_supplier_hien_hanh as
  select s.* from public.v2_dim_supplier s
  join public.v2_nap_lo l on l.id = s.lo_id and l.dang_dung;

-- ---------------------------------------------------------------------------
-- 7. PHÂN QUYỀN
--    App đọc bằng anon key → chỉ cho ĐỌC. Mọi thao tác ghi phải dùng
--    service role (chỉ có trong GitHub Actions secrets), nên anon key lộ ra
--    trình duyệt cũng không sửa được dữ liệu.
--    Khác hẳn app cũ: ở đó policy là using(true)/with check(true) — ai có
--    anon key cũng ghi đè được mọi bảng.
-- ---------------------------------------------------------------------------
alter table public.v2_nap_lo       enable row level security;
alter table public.v2_dim_brand    enable row level security;
alter table public.v2_dim_supplier enable row level security;
alter table public.v2_dim_sku      enable row level security;
alter table public.v2_dq_van_de    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['v2_nap_lo','v2_dim_brand','v2_dim_supplier','v2_dim_sku','v2_dq_van_de']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_doc', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_doc', t);
  end loop;
end $$;

-- ============================================================================
-- GỠ SẠCH (chỉ chạy khi muốn làm lại từ đầu — sẽ MẤT toàn bộ lô đã nạp)
-- ----------------------------------------------------------------------------
-- drop view  if exists public.v2_supplier_hien_hanh, public.v2_brand_hien_hanh, public.v2_sku_hien_hanh;
-- drop table if exists public.v2_dq_van_de, public.v2_dim_sku, public.v2_dim_supplier, public.v2_dim_brand, public.v2_nap_lo cascade;
-- ============================================================================
