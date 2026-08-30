# Hướng dẫn cấu hình Supabase cho Dashboard Sleep Expert

Mục tiêu: có 1 nơi lưu trữ chung, nội bộ import dữ liệu mới nhất lên đó, mọi người mở dashboard là tự tải bản mới.

## Kiến trúc (chốt)
- **Import + tính toán ngay trong trình duyệt** (dùng Pyodide chạy đúng engine hiện có) → số liệu không lệch, không ai phải cài đặt/chạy script.
- Trình duyệt đẩy **dữ liệu thô** (bảng `dataset`) và **bản RAW đã tính** (bảng `snapshot`) lên Supabase.
- Dashboard khi mở sẽ **đọc `snapshot` mới nhất** từ Supabase; nếu không có mạng/Supabase thì dùng bản nhúng sẵn (fallback).
- **File Ads tách riêng** (phòng ads phụ trách) → import với `kind = ads`; file dữ liệu chính (SKU/Sales/Tồn kho) → `kind = main`.

## Các bước anh cần làm (1 lần)

1. Vào https://supabase.com → **New project** (đặt tên, chọn region gần VN như Singapore, đặt Database password và lưu lại).
2. Mở **SQL Editor → New query**, dán toàn bộ nội dung file `supabase_schema.sql` (kèm theo) → **Run**. Sẽ tạo 2 bảng `dataset`, `snapshot` + mở quyền đọc/ghi.
3. Vào **Project Settings → API**, sao chép:
   - **Project URL** (dạng `https://xxxx.supabase.co`)
   - **anon public** key (khóa dài, phần "anon" — KHÔNG phải "service_role").
4. Gửi lại tôi **2 giá trị đó** (URL + anon key). Đây là khóa công khai, an toàn để nhúng vào dashboard (đã có RLS bảo vệ).

> Lưu ý bảo mật: KHÔNG gửi **service_role key** (khóa bí mật). Chỉ cần URL + anon key.

## Sau khi anh gửi URL + anon key, tôi sẽ làm
- Thêm trang **"Import dữ liệu"** vào dashboard (kéo-thả 2 loại file: Dữ liệu chính · Ads).
- Nối dashboard đọc bản mới nhất từ Supabase.
- Kiểm thử toàn bộ và bàn giao.

## Hai file import (mẫu)
- **Dữ liệu chính**: `Sleep Expert — Data Model (Star Schema).xlsx` (các sheet SKU, Sales_Fact, TonKho_DauKy, Dim_*).
- **Ads (riêng)**: `Sleep Expert — Ads Import.xlsx` (sheet Ads_Fact, 37 cột — giữ nguyên format báo cáo Shopee Ads).
