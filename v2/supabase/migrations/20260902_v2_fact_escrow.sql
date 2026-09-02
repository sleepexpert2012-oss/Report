-- ══════════════════════════════════════════════════════════════════════════
-- Đối soát tiền từng đơn — payment.get_escrow_detail của Shopee.
--
-- Vì sao lưu NGUYÊN VĂN dạng jsonb thay vì tách 30 cột: Shopee trả 111 trường
-- trong `order_income`, và mỗi lần cần thêm một khoản phí mà phải sửa bảng rồi
-- KÉO LẠI toàn bộ thì quá đắt. Lưu trọn một lần, bóc trường qua khung nhìn —
-- muốn thêm khoản phí chỉ cần sửa khung nhìn.
--
-- Đây cũng là lý do hàm ops-sync cũ chỉ đọc 13 trường rồi bỏ 98 trường: nó tách
-- cột cứng. Không lặp lại lỗi đó.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.v2_fact_escrow (
  order_sn                     text primary key,
  -- Ba trường dùng nhiều nhất, tách cột để truy vấn nhanh và để ràng buộc kiểu.
  escrow_amount                numeric,   -- Shopee trả người bán, TRƯỚC điều chỉnh
  escrow_amount_after_adjustment numeric, -- sau điều chỉnh — số thực nhận
  buyer_total_amount           numeric,   -- khách thanh toán
  -- Toàn bộ order_income, không bỏ trường nào.
  tho                          jsonb not null,
  nap_luc                      timestamptz not null default now(),
  nap_tu                       text not null default 'payment.get_escrow_detail'
);

create index if not exists v2_fact_escrow_nap_idx on public.v2_fact_escrow (nap_luc);

alter table public.v2_fact_escrow enable row level security;
drop policy if exists v2_fact_escrow_doc on public.v2_fact_escrow;
create policy v2_fact_escrow_doc on public.v2_fact_escrow
  for select to anon, authenticated using (true);

comment on table public.v2_fact_escrow is
  'Đối soát tiền từng đơn từ payment.get_escrow_detail. Cột tho giữ trọn order_income (111 trường) để không bao giờ phải kéo lại khi cần thêm khoản phí.';

-- ── Khung nhìn bóc các khoản của bảng lãi lỗ ──
-- Dấu của từng khoản giữ ĐÚNG như Shopee trả về. Shopee trả phí là số DƯƠNG
-- (khoản trừ) và khoản bù là số dương ở trường riêng, nên chỗ tính lãi lỗ phải
-- tự quyết dấu — không đảo dấu ở đây để khỏi đoán sai ý nghĩa.
create or replace view public.v2_escrow_pl as
select
  order_sn,
  escrow_amount,
  escrow_amount_after_adjustment,
  escrow_amount_after_adjustment - escrow_amount            as dieu_chinh,
  buyer_total_amount,

  -- Giá và giảm giá
  (tho->>'order_original_price')::numeric                   as gia_goc_don,
  (tho->>'order_selling_price')::numeric                    as gia_ban_don,
  (tho->>'order_seller_discount')::numeric                  as giam_gia_nguoi_ban,
  (tho->>'voucher_from_seller')::numeric                    as voucher_nguoi_ban,
  (tho->>'voucher_from_shopee')::numeric                    as voucher_shopee,
  (tho->>'voucher_from_external_party')::numeric            as voucher_dong_tai_tro,
  (tho->>'coins')::numeric                                  as xu_shopee,
  (tho->>'seller_coin_cash_back')::numeric                  as xu_nguoi_ban_bu,

  -- Phí sàn
  (tho->>'commission_fee')::numeric                         as phi_hoa_hong,
  (tho->>'order_ams_commission_fee')::numeric               as phi_hoa_hong_san,
  (tho->>'service_fee')::numeric                            as phi_dich_vu,
  (tho->>'campaign_fee')::numeric                           as phi_combo_khuyen_mai,
  (tho->>'seller_transaction_fee')::numeric                 as phi_giao_dich,
  (tho->>'credit_card_transaction_fee')::numeric            as phi_thanh_toan_the,
  (tho->>'buyer_transaction_fee')::numeric                  as phi_giao_dich_nguoi_mua,
  (tho->>'payment_promotion')::numeric                      as uu_dai_thanh_toan,
  (tho->>'ads_escrow_top_up_fee_or_technical_support_fee')::numeric as phi_ha_tang,

  -- Vận chuyển: vừa có khoản trừ vừa có khoản Shopee bù
  (tho->>'estimated_shipping_fee')::numeric                 as phi_vc_du_kien,
  (tho->>'actual_shipping_fee')::numeric                    as phi_vc_thuc_te,
  (tho->>'buyer_paid_shipping_fee')::numeric                as phi_vc_khach_tra,
  (tho->>'final_shipping_fee')::numeric                     as phi_vc_chot,
  (tho->>'shopee_shipping_rebate')::numeric                 as shopee_bu_vc,
  (tho->>'seller_shipping_discount')::numeric               as nguoi_ban_giam_vc,
  (tho->>'shipping_fee_discount_from_3pl')::numeric         as don_vi_vc_giam,
  (tho->>'shipping_seller_protection_fee_amount')::numeric  as bao_hiem_vc,

  -- Trả hàng
  (tho->>'seller_return_refund')::numeric                   as tien_hoan_nguoi_ban,
  (tho->>'drc_adjustable_refund')::numeric                  as hoan_dieu_chinh_duoc,
  (tho->>'reverse_shipping_fee')::numeric                   as phi_vc_chieu_nguoc,
  (tho->>'final_return_to_seller_shipping_fee')::numeric    as phi_vc_tra_ve_nguoi_ban,

  (tho->>'buyer_payment_method')                            as phuong_thuc_thanh_toan
from public.v2_fact_escrow;

comment on view public.v2_escrow_pl is
  'Bóc các khoản của bảng lãi lỗ từ v2_fact_escrow.tho. Dấu giữ đúng như Shopee trả về — chỗ tính lãi lỗ tự quyết dấu. Thêm khoản phí mới thì sửa khung nhìn này, không phải kéo lại dữ liệu.';
