# Kết nối Shopee API → Supabase → Dashboard (Edge Function)

Mục tiêu: đơn hàng Shopee tự đổ vào bảng `sales_fact` trên Supabase, dashboard tự cập nhật (không phải export Excel tay nữa).

Luồng: **Shopee API → shopee-sync (chạy theo lịch) → bảng `sales_fact` → dashboard**.

---

## 0. Chuẩn bị
- **Partner ID**: 2039280 (đã có — bản Live/thật).
- **Partner Key**: lấy trong Shopee Open Platform → App List → app của anh. **ĐÂY LÀ KHÓA BÍ MẬT — không gửi cho ai.**
- Quyết định môi trường:
  - **Sandbox** (test-stable): chỉ có shop/đơn giả lập → dùng để chạy thử luồng.
  - **Production** (`partner.shopeemobile.com`): dữ liệu shop THẬT. → Khi muốn số thật, app phải ở production và ủy quyền shop thật.
- Cài **Supabase CLI**: https://supabase.com/docs/guides/cli (hoặc dùng Dashboard để tạo function).

---

## 1. Tạo bảng lưu token
Vào Supabase → **SQL Editor** → dán nội dung file `1_supabase_shopee_token.sql` → **Run**.
(Bảng `sales_fact` đã có sẵn từ trước — không cần tạo lại.)

---

## 2. Đặt biến bí mật (Secrets)
Supabase → **Edge Functions → Secrets** (hoặc `supabase secrets set ...`):

```
SHOPEE_PARTNER_ID   = 2039280
SHOPEE_PARTNER_KEY  = <partner key bí mật của anh>
SHOPEE_HOST         = https://partner.shopeemobile.com          # production
#   (sandbox thì dùng: https://partner.test-stable.shopeemobile.com)
SHOPEE_SYNC_DAYS    = 30                                        # (tuỳ chọn) số ngày gần nhất cần đồng bộ; bỏ trống = 30
SELF_URL            = https://<project-ref>.supabase.co/functions/v1/shopee-auth
```
`SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` Supabase tự cấp cho function khi deploy.

---

## 3. Deploy 2 function
Copy 2 thư mục trong `functions/` vào `supabase/functions/` của project rồi:
```
supabase functions deploy shopee-auth --no-verify-jwt
supabase functions deploy shopee-sync --no-verify-jwt
```
`--no-verify-jwt` để Shopee gọi callback được (function auth cần công khai).

---

## 4. Ủy quyền shop (làm 1 lần)
- Khai báo **Redirect URL** trong app Shopee = chính URL của `shopee-auth`:
  `https://<project-ref>.supabase.co/functions/v1/shopee-auth`
- Mở URL đó trên trình duyệt → bấm **"Ủy quyền shop Shopee →"** → đăng nhập seller → Đồng ý.
- Shopee gọi lại, function tự lưu `access_token` + `refresh_token` vào bảng `shopee_token`.
- Thấy dòng "✅ Ủy quyền thành công cho shop …" là xong.

---

## 5. Chạy đồng bộ & kiểm tra
- Gọi thử `shopee-sync` (mở URL function, hoặc `supabase functions invoke shopee-sync`).
- Kết quả trả về `{ ok: true, orders: N, rows: M }`.
- Kiểm tra bảng `public.shopee_sync_log` (dòng mới nhất) và bảng `sales_fact` (có dữ liệu).
- Mở dashboard → dữ liệu bán hàng đã là số Shopee thật.

> Lưu ý: `shopee-sync` chỉ đồng bộ **30 ngày gần nhất** (secret `SHOPEE_SYNC_DAYS`, mặc định 30): xoá đúng phần 30 ngày trong `sales_fact` rồi kéo lại từ Shopee. Đơn cũ hơn 30 ngày KHÔNG bị đụng → chạy nhiều lần/ngày vẫn nhẹ, không kéo lại toàn bộ lịch sử.

---

## 6. Đặt lịch tự chạy (cron)
Supabase → **Database → Cron** (hoặc extension `pg_cron`) tạo job gọi `shopee-sync` 3 lần/ngày (6h/12h/20h VN):
```sql
select cron.schedule('shopee-3x-daily','0 23,5,13 * * *',  -- 23/05/13 UTC = 06/12/20 VN
  $$ select net.http_post(
       url:='https://<project-ref>.supabase.co/functions/v1/shopee-sync',
       headers:='{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb) $$);
```

---

## 7. Gỡ lỗi
- Lỗi `invalid_access_token` / `403`: token chưa ủy quyền hoặc hết hạn → chạy lại **Bước 4**.
- Lỗi chữ ký (`sign`/`error_sign`): kiểm tra `SHOPEE_PARTNER_KEY` và `SHOPEE_HOST` (đúng môi trường sandbox/production).
- Xem chi tiết ở Shopee Console → **API Access Log**, và bảng `shopee_sync_log`.
- Cột dashboard cần (engine đọc theo tên): `sku_phan_loai_hang`, `ngay_dat_hang`, `trang_thai_don_hang` ("Đã hủy" khi hủy), `so_luong`, `so_luong_san_pham_duoc_hoan_tra`, `tong_gia_ban_san_pham`, `ma_don_hang` — function đã map sẵn.

---

## Việc còn lại có thể mở rộng
- Kéo thêm **tồn kho** (`get_item_list` + `get_model_list`) → bảng `tonkho`.
- Kéo **hoàn trả** (returns API) để cột NMV chính xác hơn.
- Kéo **Ads** (Shopee Ads API) → bảng `ads_fact` (thay import file ads).

> Sau khi anh chạy thử và gửi tôi lỗi (nếu có) từ `shopee_sync_log` / API Access Log, tôi chỉnh code cho khớp đúng dữ liệu shop của anh.
