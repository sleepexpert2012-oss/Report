# INDEX — Data App (Sleep Expert Dashboard)

> Sắp xếp lại ngày 30/08/2026. Root chỉ còn file sống; dữ liệu nguồn dồn về `data-goc/`, thứ đã ngừng dùng đưa vào `obsolete/`.

## File sống (root)
- `index.html` — dashboard chính đang chạy production (1 file, dữ liệu từ Supabase)
- `purchasing_receipts.js` — module JS `index.html` nạp qua `<script src>` (biên nhận mua hàng)
- `shopee-*-callback.html` (4 file) — trang callback OAuth Shopee, **còn cần** khi uỷ quyền lại (Live đang chờ OAuth)
- `BAN-GIAO.md`, `BAN-GIAO-TAI-KHOAN-MOI.md` — tài liệu bàn giao hệ thống
- `CHANGELOG.md` — nhật ký release (thiếu R75–R81, cần bổ sung)

## Thư mục
- `v2/` — **app mới đang dựng** (xem `v2/README.md`). App cũ không bị đụng tới.
  - `contracts/` — hợp đồng dữ liệu dạng YAML: file Excel phải trông thế nào mới được nạp
  - `ingest/` — lớp nạp: đọc Excel → 3 lớp kiểm tra → báo cáo → bản ghi sạch
  - `tests/` — test khoá hành vi của lớp nạp
  - giao diện đã tách sang repo riêng `se-data-app` (ở máy: `16. AI/SE Data App/`) —
    link chạy: https://sleepexpert2012-oss.github.io/se-data-app/
  - `design/` — `DESIGN-SYSTEM.md` (quy chuẩn đã chốt) + 2 trang HTML dùng để chọn hướng
- `data-goc/` — **file GỐC từ nguồn ngoài, CHỈ ĐỌC** (xem `data-goc/_README.md`)
  - `upload-erp/` — `Sleep Expert — Data Model (Star Schema).xlsx`, `Sleep Expert — Ads Import.xlsx`
  - `mau-bieu/` — `MAU-BO-SUNG-CHI-PHI-ADS.xlsx` (biểu mẫu bù chi phí Ads)
- `scripts/` — pipeline Python: `sync_shopee_pipeline.py` (đồng bộ + cổng tươi) → `build_snapshot.py` (dựng RAW) · `revenue_rules.py` là **nơi duy nhất** định nghĩa doanh thu/giá vốn, có `test_revenue_rules.py`
- `shopee-connector/` — mã nguồn 10 Edge Functions đồng bộ Shopee + SQL cron/token
- `supabase/` — migrations + config dự án Supabase (schema **thật** nằm ở đây)
- `docs/` — tài liệu kỹ thuật
  - `QUY-TAC-DOANH-THU.md` — quy tắc doanh thu/COGS chuẩn, đọc trước khi động vào số liệu
  - `SHOPEE-DATA-COVERAGE.md` — ma trận API nào phủ dữ liệu nào
  - `MATTRESS_REVENUE_ANALYTICS_BLUEPRINT.md` — blueprint site doanh thu chuỗi cửa hàng (22/08, **chờ quyết định giữ hay lưu trữ**)
- `knowledge/` — báo cáo audit, quyết định lớn
  - `LESSONS.md` — bài học tích lũy qua các round
  - `2026-07-28_audit-vung-van-hanh-shopee.md` — audit Vùng Vận hành Shopee (chờ duyệt đề xuất)
  - `2026-08-30_nghien-cuu-app-hien-tai-va-ha-tang-app-moi.md` — nghiên cứu cách trình bày/insight của app hiện tại, di sản Vua Nệm cần bỏ, 7 tầng hạ tầng cho app viết lại
- `prompt/` — prompt giao việc cho Claude Code (`done/` = đã chạy xong)
- `Brand Assets/` — logo (bản dùng trong app đã nhúng thẳng vào `index.html` dạng data URI)
- `obsolete/` — **đã ngừng dùng, không xoá** (xem `obsolete/2026-08/_README.md`)
