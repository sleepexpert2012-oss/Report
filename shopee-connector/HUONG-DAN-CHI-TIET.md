# Hướng dẫn siêu chi tiết — Kết nối Shopee → Supabase → Dashboard
> Dành cho người KHÔNG rành API. Làm lần lượt từng chặng, không bỏ bước. Không cần cài gì trên máy — làm hết trên trình duyệt.

Thông tin của anh:
- **Live Partner ID** (bản thật, sẽ dùng): `2039280`
- **Host bản thật**: `https://partner.shopeemobile.com`
- Cần lấy: **Live Partner Key** (khóa bí mật) — ở Chặng 1.

---

## CHẶNG 1 — Lấy "Partner Key" bản thật từ Shopee  (5 phút)
1. Vào Shopee Open Platform → menu trái **App Management → App List**.
2. Bấm vào app **Data Sale**.
3. Tìm mục **Live API Partner Key** (khóa bản thật). Bấm **Copy** để chép chuỗi khóa đó.
4. Dán tạm vào Notepad. **KHÓA NÀY BÍ MẬT** — không gửi cho ai, kể cả tôi.

✅ Xong Chặng 1 khi anh đã có trong tay: Partner ID `2039280` + chuỗi Partner Key.

---

## CHẶNG 2 — Tạo bảng lưu "chìa khóa đăng nhập" trên Supabase  (3 phút)
1. Vào **supabase.com** → đăng nhập → mở đúng project đang chứa dashboard của anh.
2. Menu trái bấm **SQL Editor** → bấm **+ New query**.
3. Mở file `1_supabase_shopee_token.sql` (tôi đã gửi) → copy toàn bộ → dán vào ô query.
4. Bấm nút **Run** (góc dưới phải). Thấy "Success" là xong.

✅ Xong Chặng 2 khi chạy SQL không báo lỗi đỏ.

---

## CHẶNG 3 — Tạo Function số 1: "shopee-auth"  (5 phút)
1. Supabase → menu trái **Edge Functions**.
2. Bấm **Deploy a new function** → chọn **Via Editor** (soạn ngay trên web).
3. Ô tên function, gõ đúng: `shopee-auth`
4. Xóa hết code mẫu trong ô soạn → mở file `functions/shopee-auth/index.ts` → copy toàn bộ → dán vào.
5. Bấm **Deploy** (hoặc **Deploy function**). Chờ báo thành công.
6. Sau khi deploy, Supabase hiện **URL của function** dạng:
   `https://<mã-project>.supabase.co/functions/v1/shopee-auth`
   → Chép URL này để tí dùng.

✅ Xong Chặng 3 khi function `shopee-auth` hiện trong danh sách + anh đã chép URL của nó.

---

## CHẶNG 4 — Tạo Function số 2: "shopee-sync"  (5 phút)
1. Vẫn ở **Edge Functions** → **Deploy a new function → Via Editor**.
2. Tên: `shopee-sync`
3. Dán toàn bộ nội dung file `functions/shopee-sync/index.ts`.
4. Bấm **Deploy**. Chờ thành công.

✅ Xong Chặng 4 khi có đủ 2 function: `shopee-auth` và `shopee-sync`.

---

## CHẶNG 5 — Nhập các "thông số bí mật" (Secrets)  (5 phút)
1. Supabase → **Edge Functions** → tab **Secrets** (hoặc **Manage secrets**).
2. Bấm **Add new secret** và thêm LẦN LƯỢT từng dòng dưới đây (Tên = Name, Giá trị = Value):

| Name (gõ y hệt) | Value (điền) |
|---|---|
| `SHOPEE_PARTNER_ID` | `2039280` |
| `SHOPEE_PARTNER_KEY` | (dán Partner Key bí mật ở Chặng 1) |
| `SHOPEE_HOST` | `https://partner.shopeemobile.com` |
| `SHOPEE_SYNC_DAYS` | `30`  (tuỳ chọn — số ngày gần nhất cần đồng bộ; bỏ trống = 30) |
| `SELF_URL` | (dán URL của shopee-auth ở Chặng 3) |

3. Lưu lại.

✅ Xong Chặng 5 khi thấy đủ 5 dòng secret.

---

## CHẶNG 6 — Khai báo "địa chỉ quay về" (Redirect) bên Shopee  (3 phút)
Shopee cần biết sau khi đồng ý thì quay về đâu.
1. Về Shopee Open Platform → app **Data Sale** → phần cấu hình app (thường ở **App Information / Redirect URL**).
2. Dán vào ô Redirect URL chính là **URL của shopee-auth** (Chặng 3):
   `https://<mã-project>.supabase.co/functions/v1/shopee-auth`
3. Lưu.

> Nếu không tìm thấy ô Redirect URL, báo tôi kèm ảnh màn hình cấu hình app — tôi chỉ chỗ.

✅ Xong Chặng 6 khi đã lưu Redirect URL.

---

## CHẶNG 7 — Ủy quyền shop (bấm 1 lần)  (3 phút)
1. Mở trình duyệt, dán **URL của shopee-auth** (Chặng 3) rồi Enter.
2. Trang hiện nút **"Ủy quyền shop Shopee →"** → bấm.
3. Đăng nhập tài khoản **seller Shopee** của anh → bấm **Đồng ý / Confirm Authorization**.
4. Màn hình báo **"✅ Ủy quyền thành công cho shop …"** là xong.

✅ Xong Chặng 7 khi thấy dòng chữ thành công.

---

## CHẶNG 8 — Kéo dữ liệu về & kiểm tra  (3 phút)
1. Mở trình duyệt, dán **URL của shopee-sync** rồi Enter (URL giống auth nhưng cuối là `/shopee-sync`).
2. Chờ chạy (đơn nhiều thì hơi lâu). Thấy `{ "ok": true, "orders": …, "rows": … }` là thành công.
3. Vào Supabase → **Table Editor** → bảng `sales_fact` → thấy có dữ liệu đơn hàng.
4. Mở dashboard → dữ liệu bán hàng đã là số Shopee thật. 🎉

Nếu thấy `{ "ok": false, "message": "…" }` → **copy nguyên dòng message gửi tôi**, tôi sửa ngay.

---

## CHẶNG 9 — Cho nó tự chạy 3 lần/ngày  (2 phút, làm sau cũng được)
`shopee-sync` giờ chỉ đồng bộ **30 ngày gần nhất** (xoá đúng phần 30 ngày trong `sales_fact` rồi kéo lại từ Shopee — đơn cũ hơn 30 ngày giữ nguyên), nên chạy nhiều lần/ngày vẫn nhẹ và an toàn.

1. Supabase → **SQL Editor** → dán đoạn dưới (thay `<mã-project>` và `<SERVICE_ROLE_KEY>`), Run:
```sql
-- Chạy 3 khung giờ VN: 06:00, 12:00, 20:00 (Supabase cron dùng giờ UTC, VN = UTC+7)
select cron.schedule('shopee-3x-daily','0 23,5,13 * * *',
  $$ select net.http_post(
     url:='https://<mã-project>.supabase.co/functions/v1/shopee-sync',
     headers:='{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb) $$);
```
Quy đổi giờ (UTC → VN): `23:00 UTC = 06:00 VN` · `05:00 UTC = 12:00 VN` · `13:00 UTC = 20:00 VN`.
`SERVICE_ROLE_KEY` lấy ở **Project Settings → API**.

> Đổi số ngày đồng bộ: thêm secret `SHOPEE_SYNC_DAYS` (mặc định 30) ở **Edge Functions → Secrets**.
> Nếu trước đó đã tạo lịch cũ tên `shopee-daily`, gỡ bằng: `select cron.unschedule('shopee-daily');`

---

### Ghi nhớ nhanh
- Bí mật: **Partner Key** và **SERVICE_ROLE_KEY** — đừng để lộ.
- Lỗi `invalid_access_token` → làm lại Chặng 7.
- Lỗi chữ ký `sign` → kiểm tra lại Partner Key (Chặng 5) đúng bản **Live**.
- Cần trợ giúp chặng nào → chụp màn hình gửi tôi.
