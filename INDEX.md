# INDEX — Data App (Sleep Expert Dashboard)

## File sống (root)
- `index.html` — dashboard chính (1 file, chạy trình duyệt, dữ liệu Supabase)
- `BAN-GIAO.md`, `BAN-GIAO-TAI-KHOAN-MOI.md` — tài liệu bàn giao hệ thống
- `CHANGELOG.md` — nhật ký release

## Thư mục
- `prompt/` — prompt giao việc cho Claude Code (`done/` = đã chạy xong)
- `knowledge/` — báo cáo audit, quyết định lớn
  - `LESSONS.md` — bài học tích lũy qua các round
  - `2026-07-28_audit-vung-van-hanh-shopee.md` — audit Giai đoạn 1 Vùng Vận hành Shopee (chờ duyệt đề xuất)
- `docs/` — tài liệu kỹ thuật (SHOPEE-DATA-COVERAGE.md: ma trận API)
- `supabase/` — migrations + config dự án Supabase
- `shopee-connector/` — mã nguồn Edge Functions đồng bộ Shopee (bản lưu)
- `scripts/` — build_snapshot.py (dựng RAW từ Data Model)
- `Referance data/` và các file `Sleep Expert — *.xlsx` — dữ liệu nguồn/tham chiếu
