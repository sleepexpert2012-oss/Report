-- Bảng thô: mỗi sheet 1 bảng (đúng cột theo header). Chạy 1 lần.


drop table if exists public.sku cascade;
create table public.sku (
  _id bigint generated always as identity primary key,
  "ma_san_pham" text,
  "sku" text,
  "category" text,
  "nganh_hang" text,
  "subcategory_code" text,
  "subcategory_name" text,
  "chat_lieu" text,
  "id_ma_san_pham_shopee" text,
  "variation_code" text,
  "variation_name" text,
  "ten_san_pham_kich_thuoc_cao_x_rong_x_dai_cm" text,
  "supplier_code" text,
  "brand" text,
  "vat_lieu_chinh" text,
  "cao" text,
  "rong" text,
  "dai" text,
  "net_weight" text,
  "gross_weight" text,
  "dong_goi" text,
  "packaget_length" text,
  "packaget_width" text,
  "package_height" text,
  "mau" text,
  "min_order" text,
  "leadtime" text,
  "unit_cost_usd" text,
  "unit_cost_vnd" text,
  "gia_von_vat" text,
  "sales_price_vnd" text,
  "abc_class" text,
  "m3" text
);

drop table if exists public.dim_nganh cascade;
create table public.dim_nganh (
  _id bigint generated always as identity primary key,
  "nganh_hang_khoa" text,
  "category_code" text,
  "ghi_chu" text
);

drop table if exists public.dim_brand cascade;
create table public.dim_brand (
  _id bigint generated always as identity primary key,
  "brand_khoa" text,
  "nhom_brand" text,
  "xuat_xu_ncc" text,
  "trang_thai" text,
  "ghi_chu" text
);

drop table if exists public.dim_class cascade;
create table public.dim_class (
  _id bigint generated always as identity primary key,
  "subcategory_name_khoa" text,
  "ma_san_pham" text,
  "nganh_hang" text,
  "brand" text,
  "loai_hinh" text,
  "phan_khuc_gia" text,
  "nhan_vong_doi" text,
  "vai_tro_sp" text,
  "sp_thay_the" text,
  "first_sale" text,
  "mua_vu" text,
  "gia_ban_tb_ngd" text,
  "gia_von_tb_ngd" text
);

drop table if exists public.sales_fact cascade;
create table public.sales_fact (
  _id bigint generated always as identity primary key,
  "ma_don_hang" text,
  "ma_kien_hang" text,
  "ngay_dat_hang" text,
  "trang_thai_don_hang" text,
  "san_pham_ban_chay" text,
  "ly_do_huy" text,
  "nhan_xet_tu_nguoi_mua" text,
  "ma_van_don" text,
  "don_vi_van_chuyen" text,
  "phuong_thuc_giao_hang" text,
  "loai_don_hang" text,
  "ngay_xuat_hang" text,
  "ngay_giao_hang_du_kien" text,
  "ngay_giao_hang_noi_dia" text,
  "thoi_gian_giao_hang" text,
  "thoi_gian_hoan_thanh_don_hang" text,
  "trang_thai_tra_hang_hoan_tien" text,
  "ngay_huy_thanh_cong" text,
  "don_hang_duoc_xu_ly_boi_shopee" text,
  "sku_san_pham" text,
  "ten_san_pham" text,
  "can_nang_san_pham" text,
  "tong_can_nang" text,
  "ten_kho_hang" text,
  "sku_phan_loai_hang" text,
  "ten_phan_loai_hang" text,
  "so_huu_boi_shopee" text,
  "gia_goc" text,
  "nguoi_ban_tro_gia" text,
  "duoc_shopee_tro_gia" text,
  "tong_so_tien_duoc_nguoi_ban_tro_gia" text,
  "gia_uu_dai" text,
  "so_luong" text,
  "so_luong_san_pham_duoc_hoan_tra" text,
  "tong_gia_ban_san_pham" text,
  "tong_gia_tri_don_hang_vnd" text,
  "ma_giam_gia_cua_shop" text,
  "hoan_xu" text,
  "ma_giam_gia_cua_shopee" text,
  "chi_tieu_combo_khuyen_mai" text,
  "giam_gia_tu_combo_shopee" text,
  "giam_gia_tu_combo_cua_shop" text,
  "shopee_xu_duoc_hoan" text,
  "so_tien_duoc_giam_khi_thanh_toan_bang_the_ghi_no" text,
  "trade_in_discount" text,
  "trade_in_bonus" text,
  "phi_van_chuyen_du_kien" text,
  "trade_in_bonus_by_seller" text,
  "phi_van_chuyen_ma_nguoi_mua_tra" text,
  "phi_tra_hang" text,
  "tong_so_tien_nguoi_mua_thanh_toan" text,
  "thoi_gian_don_hang_duoc_thanh_toan" text,
  "ngay_xac_minh_ky_quy" text,
  "phuong_thuc_thanh_toan" text,
  "phi_co_dinh" text,
  "phi_dich_vu" text,
  "phi_thanh_toan" text,
  "tien_ky_quy" text,
  "nguoi_mua" text,
  "ten_nguoi_nhan" text,
  "so_dien_thoai" text,
  "tinh_thanh_pho" text,
  "tp_quan_huyen" text,
  "quan" text,
  "dia_chi_nhan_hang" text,
  "quoc_gia" text
);

drop table if exists public.dim_kho cascade;
create table public.dim_kho (
  _id bigint generated always as identity primary key,
  "ma_kho_khoa" text,
  "ten_kho" text,
  "ton_kha_dung" text,
  "ghi_chu" text
);

drop table if exists public.tonkho cascade;
create table public.tonkho (
  _id bigint generated always as identity primary key,
  "sku_khoa" text,
  "ten_san_pham" text,
  "ma_kho_khoa" text,
  "ten_kho" text,
  "ton_hien_tai" text,
  "ton_kha_dung" text
);

drop table if exists public.rules cascade;
create table public.rules (
  _id bigint generated always as identity primary key,
  "tham_so" text,
  "gia_tri" text,
  "dien_giai" text
);

drop table if exists public.ads_fact cascade;
create table public.ads_fact (
  _id bigint generated always as identity primary key,
  "ngay" text,
  "thang" text,
  "nam" text,
  "thu_tu" text,
  "ten_dich_vu_hien_thi" text,
  "trang_thai" text,
  "loai_dich_vu_hien_thi" text,
  "ma_san_pham" text,
  "noi_dung_dich_vu_hien_thi" text,
  "phuong_thuc_dau_thau" text,
  "vi_tri" text,
  "tu_khoa_vi_tri" text,
  "loai_tu_khoa" text,
  "ngay_bat_dau" text,
  "ngay_ket_thuc" text,
  "cot_shopee_an" text,
  "so_luot_xem" text,
  "so_luot_click" text,
  "ty_le_click" text,
  "luot_chuyen_doi" text,
  "luot_chuyen_doi_truc_tiep" text,
  "ty_le_chuyen_doi" text,
  "ty_le_chuyen_doi_truc_tiep" text,
  "chi_phi_cho_moi_luot_chuyen_doi" text,
  "chi_phi_cho_moi_luot_chuyen_doi_truc_tiep" text,
  "san_pham_da_ban" text,
  "san_pham_da_ban_truc_tiep" text,
  "doanh_so" text,
  "doanh_so_truc_tiep" text,
  "chi_phi" text,
  "roas" text,
  "roas_truc_tiep" text,
  "acos" text,
  "acos_truc_tiep" text,
  "luot_xem_san_pham" text,
  "luot_clicks_san_pham" text,
  "ty_le_click_san_pham" text
);

drop table if exists public.ads_plan cascade;
create table public.ads_plan (
  month text primary key,
  payload jsonb not null,
  uploaded_by text,
  updated_at timestamptz default now()
);

alter table public.sku enable row level security;
drop policy if exists sku_all on public.sku;
create policy sku_all on public.sku for all using (true) with check (true);

alter table public.dim_nganh enable row level security;
drop policy if exists dim_nganh_all on public.dim_nganh;
create policy dim_nganh_all on public.dim_nganh for all using (true) with check (true);

alter table public.dim_brand enable row level security;
drop policy if exists dim_brand_all on public.dim_brand;
create policy dim_brand_all on public.dim_brand for all using (true) with check (true);

alter table public.dim_class enable row level security;
drop policy if exists dim_class_all on public.dim_class;
create policy dim_class_all on public.dim_class for all using (true) with check (true);

alter table public.sales_fact enable row level security;
drop policy if exists sales_fact_all on public.sales_fact;
create policy sales_fact_all on public.sales_fact for all using (true) with check (true);

alter table public.dim_kho enable row level security;
drop policy if exists dim_kho_all on public.dim_kho;
create policy dim_kho_all on public.dim_kho for all using (true) with check (true);

alter table public.tonkho enable row level security;
drop policy if exists tonkho_all on public.tonkho;
create policy tonkho_all on public.tonkho for all using (true) with check (true);

alter table public.rules enable row level security;
drop policy if exists rules_all on public.rules;
create policy rules_all on public.rules for all using (true) with check (true);

alter table public.ads_fact enable row level security;
drop policy if exists ads_fact_all on public.ads_fact;
create policy ads_fact_all on public.ads_fact for all using (true) with check (true);

alter table public.ads_plan enable row level security;
drop policy if exists ads_plan_all on public.ads_plan;
create policy ads_plan_all on public.ads_plan for all using (true) with check (true);
