-- Cột lưu SỐ TIỀN hoàn từ Shopee Returns API (refund_amount).
-- Trước đây không có cột nào giữ giá trị này: hàm đồng bộ nhét nhầm vào
-- `phi_tra_hang` — cột dành cho PHÍ trả hàng — rồi cũng không ai đọc.
-- Chạy TRƯỚC khi triển khai bản ops-sync mới, nếu không update sẽ lỗi cột.
alter table public.sales_fact
  add column if not exists so_tien_hoan text;

comment on column public.sales_fact.so_tien_hoan is
  'Số tiền Shopee hoàn cho đơn, lấy từ returns.get_return_list.refund_amount. Kiểu text cho đồng bộ với các cột khác của bảng này.';
