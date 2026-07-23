# Edge Functions đang chạy trên Supabase (bản sao lưu)

> ⚠️ Các file trong thư mục này là **bản sao lưu tải về từ Supabase** (project `jkrczsrhonmqxwzzdgen`) ngày 2026-07-17.
> Tên thư mục = **slug thật của function trên Supabase** (Supabase tự sinh tên ngẫu nhiên khi tạo — không phải shopee-auth/shopee-sync như tài liệu cũ).
> Đây mới là code THẬT đang chạy; nếu sửa, sửa ở đây rồi deploy lại lên đúng slug.

| Slug (Supabase) | Chức năng | Bảng ghi | Env chính |
|---|---|---|---|
| `swift-handler` | Ủy quyền **đơn hàng** (OAuth 1 lần) | `shopee_token` | `SHOPEE_PARTNER_ID/KEY`, `SELF_URL` |
| `smooth-responder` | Đồng bộ **đơn hàng** → dashboard | `sales_fact`, `shopee_sync_state` | `SHOPEE_PARTNER_ID/KEY`, `SHOPEE_START_DATE` |
| `swift-task` | Ủy quyền **Ads** (OAuth 1 lần) | `shopee_ads_token` | `SHOPEE_ADS_PARTNER_ID/KEY`, `ADS_SELF_URL` |
| `bright-responder` | Đồng bộ **hiệu suất Ads** (campaign daily) | `ads_fact`, `shopee_ads_state` | `SHOPEE_ADS_PARTNER_ID/KEY`, `SHOPEE_START_DATE` |
| `smart-endpoint` | Đồng bộ **từ khóa Ads** (recommended keywords) | `ads_keyword` | `SHOPEE_ADS_PARTNER_ID/KEY` |

## Đặc điểm quan trọng của `smooth-responder` (đồng bộ đơn)
- **Có nhớ tiến độ** qua bảng `shopee_sync_state` (mỗi shop lưu `next_from`, `done`).
- **Tự giới hạn thời gian chạy** (`BUDGET` ms) để tránh timeout Edge Function — chạy gần hết giờ thì lưu tiến độ và trả trang HTML tự refresh chạy tiếp.
- Lần đầu (chưa có state): xóa sạch `sales_fact` rồi kéo từ `SHOPEE_START_DATE`.
- Khi đã đồng bộ xong toàn bộ (`done=true`): mỗi lần chỉ làm mới **N ngày gần nhất** (xóa theo từng mã đơn rồi ghi lại, không xóa sạch bảng).

## Lịch tự chạy (pg_cron trên Supabase) — cập nhật 2026-07-17
| Job | Lịch (UTC) | Giờ VN | Gọi function |
|---|---|---|---|
| `shopee-sync-daily` | `0 23,5,13 * * *` | 06:00 / 12:00 / 20:00 | `smooth-responder` (đơn hàng) |
| `shopee-ads-daily` | `10 23,5,13 * * *` | 06:10 / 12:10 / 20:10 | `bright-responder` (chi phí Ads) |
| `shopee-ads-kw-daily` | `20 23 * * *` | 06:20 | `smart-endpoint` (từ khóa Ads) |

Các function đều public (`verify_jwt=false`) nên cron gọi URL không cần Authorization header.
Gỡ 1 job: `select cron.unschedule('<jobname>');`

## Snapshot dashboard (giai đoạn 2)

Dashboard không còn đọc và tính lại toàn bộ bảng nguồn mỗi lần mở. Workflow
`.github/workflows/build-dashboard-snapshot.yml` chạy lúc 06:35 / 12:35 / 20:35
(giờ Việt Nam), sau các job đồng bộ Shopee, rồi:

1. đọc song song 9 bảng nguồn;
2. chạy đúng engine Python đang dùng trong dashboard;
3. upsert một dòng `snapshot/current`;
4. dashboard tải snapshot bằng một request.

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
