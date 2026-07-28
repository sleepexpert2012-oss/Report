-- Chạy trong Supabase SQL Editor SAU KHI deploy lại Edge Function ops-sync.
--
-- Vì sao cần cron này:
-- Trước đây ops-sync KHÔNG có lịch chạy tự động, chỉ chạy khi có người bấm nút
-- "↻ Đồng bộ phân tích" trong app. Kết hợp với việc hàm duyệt đơn cũ trước và
-- không có chặn thời gian, phần đối soát escrow của đơn mới không bao giờ tới lượt
-- (mốc gãy thực tế: mọi đơn từ 01/07/2026 trở đi trống phí + tiền thực nhận).
--
-- Lịch: phút thứ 10 của các giờ 23,2,5,8,11,13,17,20 UTC
--       = 06:10 / 09:10 / 12:10 / 15:10 / 18:10 / 20:10 / 00:10 / 03:10 giờ Việt Nam.
-- Cố ý đặt TRƯỚC cron tồn kho (:25) và trước workflow build snapshot (:35)
-- để snapshot luôn đọc được dữ liệu đối soát mới nhất.
--
-- Hàm tự bỏ qua đơn đã có tiền ký quỹ và tự dừng khi hết ngân sách thời gian,
-- nên chạy dày không gây gọi lại API thừa; phần còn thiếu sẽ được làm tiếp ở lượt sau.

select cron.unschedule(jobid)
from cron.job
where jobname = 'shopee-ops-sync';

select cron.schedule(
  'shopee-ops-sync',
  '10 23,2,5,8,11,13,17,20 * * *',
  $$
  select net.http_post(
    url := 'https://jkrczsrhonmqxwzzdgen.supabase.co/functions/v1/ops-sync',
    headers := '{"content-type":"application/json"}'::jsonb,
    body := '{"mode":"sync","days":120}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Kiểm tra lịch đã đăng ký:
--   select jobname, schedule, active from cron.job order by jobname;
--
-- Theo dõi tiến độ làm giàu đơn (hàm ghi checkpoint sau mỗi lượt chạy):
--   select status, rows_synced, cursor, metadata, error_message, last_success_at
--   from public.shopee_sync_checkpoint
--   where endpoint = 'order_enrichment/escrow_tracking';
--
--   status = 'complete' → đã làm hết đơn còn thiếu trong cửa sổ.
--   status = 'partial'  → còn tồn, xem cursor->>'remaining'; lượt chạy sau sẽ làm tiếp.
