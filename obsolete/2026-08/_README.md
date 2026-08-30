# Lưu trữ tháng 08/2026

Toàn bộ file trong thư mục này **đã ngừng dùng** nhưng KHÔNG được xoá — giữ để truy vết lịch sử.
Đã kiểm chứng ngày 30/08/2026: không file đang chạy nào (workflow, script, Edge Function, index.html)
tham chiếu tới chúng. Đã chạy lại `build_snapshot.py --dry-run` sau khi chuyển: pipeline vẫn tốt.

| Thư mục | Nội dung | Vì sao ngừng dùng |
|---|---|---|
| `ban-cu-app/` | `Sleep Expert — SKU Performance Console.html` | Bản build cũ (2.466 dòng, 12/07/2026). Chưa có vùng Shopee v2, chưa có `salesCanonical`, chưa có `_SUPA_MAP` — tức là có trước cả pipeline Supabase. Bản đang chạy là `index.html` (6.323 dòng). |
| `referance-data-vuanem/` | 6 file `VuaNem_*.xlsx` | Dữ liệu tham chiếu của Vua Nệm, nguồn gốc các khái niệm kế thừa (GBB, mapping chăn ga, matrix sản phẩm). Không phải dữ liệu Sleep Expert. |
| `huong-dan-lac-hau/` | `HUONG-DAN.md`, `HUONG-DAN-CHI-TIET.md`, `Sleep Expert — Huong dan Supabase.md` | `BAN-GIAO.md` đã ghi rõ 2 file đầu "đã lạc hậu" — còn dùng tên function cũ (shopee-auth/shopee-sync) và biến môi trường không còn tồn tại. |
| `schema-sql-lac-hau/` | `supabase_schema.sql`, `supabase_tables.sql`, `supabase_migration_v2.sql` | Không khớp database thật: `supabase_schema.sql` khai bảng `snapshot` không có cột `slot`, trong khi `build_snapshot.py` upsert `on_conflict=slot`. Ai chạy lại file này để dựng môi trường sẽ bị vỡ. Schema thật hiện nằm ở `supabase/migrations/`. |
| `Sleep Expert Dashboard — Lo trinh thay the.md` | Lộ trình thay thế đời trước (11/07/2026) | Đã được thay bằng `knowledge/2026-08-30_nghien-cuu-app-hien-tai-va-ha-tang-app-moi.md`. |

Theo quy tắc dự án: sau ~90 ngày mới cân nhắc dọn hẳn, và chỉ khi được duyệt.
