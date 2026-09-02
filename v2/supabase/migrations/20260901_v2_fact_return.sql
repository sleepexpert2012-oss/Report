-- ══════════════════════════════════════════════════════════════════════════
-- Bảng sự kiện TRẢ HÀNG / HOÀN TIỀN — lấy từ đúng module Returns của Shopee.
--
-- Luật Louis chốt 31/8/2026: dữ liệu nào lấy đúng từ API của mục đó. Bảng này
-- CHỈ nhận dữ liệu từ returns.get_return_list và returns.get_return_detail.
-- Không suy từ escrow, không lấy từ file Excel.
--
-- Vì sao TÁCH LÀM HAI BẢNG: `refund_amount` là số tiền của cả YÊU CẦU TRẢ, còn
-- số lượng nằm ở từng sản phẩm. Nhét chung một bảng thì mỗi dòng sản phẩm lặp
-- lại số tiền, ai lỡ SUM lên là cộng thừa. Tách ra thì không có cách nào sai.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Đầu yêu cầu trả: mỗi mã yêu cầu một dòng ──
create table if not exists public.v2_fact_return (
  return_sn              text primary key,   -- returns.get_return_list -> return_sn
  order_sn               text not null,      -- khớp sales_fact.ma_don_hang
  status                 text,               -- ReturnStatus: REQUESTED / ACCEPTED / ...
  negotiation_status     text,
  reason                 text,               -- ReturnReason do người mua chọn
  text_reason            text,               -- lý do người mua tự gõ
  refund_amount          numeric,            -- ⭐ SỐ TIỀN HOÀN, cấp yêu cầu trả
  currency               text,
  amount_before_discount numeric,
  needs_logistics        boolean,            -- có phải gửi hàng về không
  tracking_number        text,
  create_time            timestamptz,        -- lúc tạo yêu cầu trả
  update_time            timestamptz,
  nap_luc                timestamptz not null default now(),
  nap_tu                 text not null default 'returns.get_return_list'
);

-- ── Sản phẩm trong yêu cầu trả: mỗi sản phẩm một dòng ──
create table if not exists public.v2_fact_return_item (
  return_sn      text not null references public.v2_fact_return(return_sn) on delete cascade,
  vi_tri         int  not null,              -- chỉ số trong mảng item[]
  item_id        bigint,
  model_id       bigint,
  item_sku       text,                       -- SKU cha
  variation_sku  text,                       -- SKU phân loại, khớp sales_fact.sku_phan_loai_hang
  ten            text,
  so_luong       numeric,                    -- ⭐ item[].amount — SỐ LƯỢNG hoàn
  gia            numeric,                    -- item[].item_price
  primary key (return_sn, vi_tri)
);

create index if not exists v2_fact_return_don_idx   on public.v2_fact_return (order_sn);
create index if not exists v2_fact_return_ngay_idx  on public.v2_fact_return (create_time);
create index if not exists v2_fact_return_item_sku_idx on public.v2_fact_return_item (variation_sku);

-- ── Chỉ cho ĐỌC bằng khoá anon, giống mọi bảng v2_ khác ──
alter table public.v2_fact_return      enable row level security;
alter table public.v2_fact_return_item enable row level security;
drop policy if exists v2_fact_return_doc      on public.v2_fact_return;
drop policy if exists v2_fact_return_item_doc on public.v2_fact_return_item;
create policy v2_fact_return_doc      on public.v2_fact_return      for select to anon, authenticated using (true);
create policy v2_fact_return_item_doc on public.v2_fact_return_item for select to anon, authenticated using (true);

comment on column public.v2_fact_return.refund_amount is
  'Số tiền hoàn của CẢ yêu cầu trả, không phải của từng sản phẩm. Muốn tổng tiền hoàn thì SUM trên bảng này, KHÔNG join sang v2_fact_return_item rồi mới SUM.';
comment on column public.v2_fact_return_item.so_luong is
  'item[].amount trong returns.get_return_list — số lượng sản phẩm được hoàn.';
