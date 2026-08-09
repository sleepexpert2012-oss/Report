# Edge Functions đang chạy trên Supabase (bản sao lưu)

> ⚠️ Các file trong thư mục này là **bản sao lưu tải về từ Supabase** (project `jkrczsrhonmqxwzzdgen`) ngày 2026-07-17.
> Tên thư mục = **slug thật của function trên Supabase** (Supabase tự sinh tên ngẫu nhiên khi tạo — không phải shopee-auth/shopee-sync như tài liệu cũ).
> Đây mới là code THẬT đang chạy; nếu sửa, sửa ở đây rồi deploy lại lên đúng slug.

| Slug (Supabase) | Chức năng | Bảng ghi | Env chính |
|---|---|---|---|
| `swift-handler` | Ủy quyền **đơn hàng** (OAuth 1 lần) | `shopee_token` | `SHOPEE_PARTNER_ID/KEY`, `SELF_URL` |
| `smooth-responder` | Đồng bộ **đơn hàng** → dashboard | `sales_fact`, `shopee_sync_state` | `SHOPEE_PARTNER_ID/KEY`, `SHOPEE_START_DATE` |
| `inventory-responder` | Đồng bộ **tồn khả dụng Shopee** → dashboard | `tonkho`, `dim_kho` | `SHOPEE_PARTNER_ID/KEY` |
| `swift-task` | Ủy quyền **Ads** (OAuth 1 lần) | `shopee_ads_token` | `SHOPEE_ADS_PARTNER_ID/KEY`, `ADS_SELF_URL` |
| `bright-responder` | Đồng bộ **hiệu suất Ads** (campaign daily) | `ads_fact`, `shopee_ads_state` | `SHOPEE_ADS_PARTNER_ID/KEY`, `SHOPEE_START_DATE` |
| `smart-endpoint` | Đồng bộ **từ khóa Ads** (recommended keywords) | `ads_keyword` | `SHOPEE_ADS_PARTNER_ID/KEY` |

## ⚠ ĐANG CHỜ DEPLOY — 4 sửa đổi đã sẵn sàng trong repo

Chưa deploy được vì tài khoản Supabase CLI hiện tại không có quyền trên project live (403).
Deploy một lần cả hai function:

```bash
supabase login
supabase functions deploy ops-sync
supabase functions deploy smooth-responder
# sau đó chạy lại để ghi đè dữ liệu cũ:
curl -X POST https://jkrczsrhonmqxwzzdgen.supabase.co/functions/v1/ops-sync \
  -H 'Content-Type: application/json' -d '{"mode":"sync","days":600,"force":true}'
```

| # | Sửa gì | Vì sao |
|---|---|---|
| 1 | `ops-sync`: xử lý đơn mới nhất trước + chặn thời gian + checkpoint | Đơn mới không bao giờ tới lượt, hàm chết lặng (đã deploy 28/07) |
| 2 | `ops-sync`: phí thanh toán chỉ lấy MỘT lần | Shopee trả cùng khoản ở `seller_transaction_fee` và `credit_card_transaction_fee`; cộng cả hai là tính đôi (~18tr toàn kỳ) |
| 3 | `ops-sync`: ghi thêm 8 cột escrow đang bỏ phí | `gia_goc`, `gia_uu_dai`, voucher seller/Shopee, phí vận chuyển, hoàn xu — API VẪN trả về trong chính lời gọi hiện tại nhưng hàm vứt đi |
| 4 | `ops-sync` + `smooth-responder`: giữ trạng thái `TO_RETURN` | Mọi trạng thái ≠ `CANCELLED` bị gộp thành "Hoàn thành" nên đơn khách trả hàng đọc thành bán thành công; cột `trang_thai_tra_hang_hoan_tien` trống 0/2690 |

Sau khi deploy và chạy lại, bảng P&L sẽ có số hoàn trả THẬT thay cho ước tính, tách được
voucher shop / trợ giá Shopee thay vì gộp một cục, và phí thanh toán hết bị thổi lên.

## `ops-sync` — làm giàu đơn (phí sàn, escrow, tracking)

Cập nhật 28/07/2026 sau khi phát hiện dữ liệu phí/tiền thực nhận trống toàn bộ từ 01/07/2026.

**Lỗi cũ:** vòng làm giàu đơn duyệt theo `_id` tăng dần (đơn CŨ trước), không có chặn thời gian,
không có checkpoint. Edge Function hết giờ chạy thì chết lặng; lần chạy sau lại bắt đầu từ đơn cũ nhất
và gọi lại API cho đơn đã có dữ liệu → đơn mới không bao giờ tới lượt. Đo thực tế: đơn tháng 7 nằm ở
vị trí 215/287 trong hàng đợi.

**Đã sửa:**
- Xử lý **đơn mới nhất trước** (`sort` giảm dần theo ngày đặt).
- **Bỏ qua đơn đã có `tien_ky_quy`** — gọi với `{"force":true}` nếu muốn làm lại toàn bộ.
- **Chặn thời gian** `budget_ms` (mặc định 90.000ms, đổi qua env `OPS_SYNC_BUDGET_MS` hoặc body).
  Áp dụng cho cả vòng `get_order_detail`, vòng escrow/tracking và vòng returns.
- **Ghi checkpoint** `order_enrichment/escrow_tracking`: `status` complete/partial, `cursor->>'remaining'`
  cho biết còn bao nhiêu đơn chưa làm.
- Response trả thêm khối `enrichment` (processed / remaining / stopped_by_budget / elapsed_ms).

**Deploy lại:**
```bash
supabase link --project-ref jkrczsrhonmqxwzzdgen
supabase functions deploy ops-sync --project-ref jkrczsrhonmqxwzzdgen
```
Sau đó chạy `shopee-connector/3_ops_sync_cron.sql` trong SQL Editor để bật lịch tự động
(trước đây `ops-sync` KHÔNG có cron, chỉ chạy khi bấm nút trong app).

## Đặc điểm quan trọng của `smooth-responder` (đồng bộ đơn)
- **Có nhớ tiến độ** qua bảng `shopee_sync_state` (mỗi shop lưu `next_from`, `done`).
- **Tự giới hạn thời gian chạy** (`BUDGET` ms) để tránh timeout Edge Function — chạy gần hết giờ thì lưu tiến độ và trả trang HTML tự refresh chạy tiếp.
- Lần đầu (chưa có state): xóa sạch `sales_fact` rồi kéo từ `SHOPEE_START_DATE`.
- Khi đã đồng bộ xong toàn bộ (`done=true`): mỗi lần chỉ làm mới **N ngày gần nhất** (xóa theo từng mã đơn rồi ghi lại, không xóa sạch bảng).

## Lịch tự chạy — cập nhật 2026-08-09
| Job | Lịch (UTC) | Giờ VN | Gọi function |
|---|---|---|---|
| `shopee-sync-daily` | `0 23,5,13 * * *` | 06:00 / 12:00 / 20:00 | `smooth-responder` (đơn hàng) |
| `shopee-ads-daily` | `10 23,5,13 * * *` | 06:10 / 12:10 / 20:10 | `bright-responder` (chi phí Ads) |
| `shopee-ads-kw-daily` | `20 23 * * *` | 06:20 | `smart-endpoint` (từ khóa Ads) |
| `shopee-inventory-daily` | `25 23,5,13 * * *` | 06:25 / 12:25 / 20:25 | `inventory-responder` (tồn kho) |

> Từ R76, tồn kho phục vụ dashboard còn được đồng bộ **mỗi giờ** ngay trong
> workflow `build-dashboard-snapshot.yml`. Workflow luôn gọi
> `inventory-responder` thành công trước khi build snapshot, nên không còn khe
> hở do pg_cron và GitHub Actions chạy lệch nhau. Job pg_cron 3 lần/ngày được
> giữ làm phương án dự phòng.

## Đồng bộ tồn kho Shopee

- Dùng cùng OAuth token của app `Data Sale`; không cần tạo thêm app `Seller Logistics`.
- Đọc sản phẩm `NORMAL` và `UNLIST` qua Product API v2.
- SKU có phân loại lấy từ `model_sku`; SKU không phân loại lấy từ `item_sku`.
- Số tồn ưu tiên `stock_info_v2.summary_info.total_available_stock`.
- Toàn bộ tồn Shopee được ghi vào `WH04 — Kho Shopee Ecommerce`.
- Function tải và kiểm tra xong toàn bộ dữ liệu trước khi thay bảng `tonkho`.
- Nếu Shopee trả về 0 SKU, function mặc định giữ nguyên dữ liệu cũ. Chỉ đặt
  `SHOPEE_ALLOW_EMPTY_INVENTORY_SYNC=true` nếu thật sự muốn cho phép bảng rỗng.

Các function đều public (`verify_jwt=false`) nên cron gọi URL không cần Authorization header.
Gỡ 1 job: `select cron.unschedule('<jobname>');`

## Snapshot dashboard (giai đoạn 2)

Dashboard không còn đọc và tính lại toàn bộ bảng nguồn mỗi lần mở. Workflow
`.github/workflows/build-dashboard-snapshot.yml` chạy mỗi giờ. Trong cùng một
job, workflow đồng bộ tồn kho Shopee trước rồi:

1. xác nhận `inventory-responder` trả `ok=true`;
2. đọc song song 9 bảng nguồn;
3. chạy đúng engine Python đang dùng trong dashboard;
4. upsert một dòng `snapshot/current`;
5. cập nhật lại `created_at` để app hiển thị đúng giờ snapshot mới nhất;
6. dashboard tải snapshot bằng một request.

Repository cần hai GitHub Actions secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Có thể chạy ngay bằng nút **Run workflow** của workflow `Build dashboard snapshot`.
Script `python scripts/build_snapshot.py --dry-run` dùng để kiểm tra cục bộ mà
không ghi dữ liệu lên Supabase.

## Giới hạn coverage đã biết
- `bright-responder` chỉ kéo **quảng cáo cấp SẢN PHẨM** (`get_product_level_campaign_*`). **Quảng cáo cấp Shop** (nếu có chạy) KHÔNG được đồng bộ → tổng chi phí trong `ads_fact` có thể thấp hơn số tổng trên app seller.

## Cách deploy lại 1 function (khi sửa code)
Dashboard: Supabase → Edge Functions → mở đúng slug → dán nội dung `index.ts` → Deploy.
Hoặc qua Management API (cần Personal Access Token).
