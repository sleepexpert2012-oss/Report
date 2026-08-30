# Bảng của app cũ đang cho ghi và xoá bằng khoá công khai

Ngày phát hiện: 30/8/2026 · Người kiểm: Claude, trong lúc chuẩn bị publish app v2

## Việc đã xảy ra

Trước khi đưa app v2 lên link công khai, tôi kiểm lại RLS bằng khoá anon. Với các
bảng `v2_` thì đúng như thiết kế: `insert` trả **401**. Nhưng khi thử sang bảng
của app cũ:

```
POST /rest/v1/sales_fact  →  201 Created
```

Dòng đó **đã được tạo thật** (`_id = 95457`, toàn null, bảng lên 2.840 dòng).
Tôi xoá ngay bằng chính khoá anon đó — và **lệnh xoá cũng chạy được**, trả về
nguyên dòng vừa xoá. Bảng về đúng 2.839 dòng, không còn dòng null nào.

Đây là lỗi của tôi: tôi cho rằng bảng cũ cũng khoá như bảng `v2_` nên thử ghi
thẳng vào production thay vì hỏi trước.

## Vấn đề

Khoá `anon` nằm sẵn trong `index.html` của app cũ. App cũ đang chạy ở
`https://sleepexpert2012-oss.github.io/Report/` — link công khai, repo cũng
công khai. Bất kỳ ai mở trang, bấm *xem mã nguồn* là có khoá.

Với khoá đó, các bảng sau **đọc, ghi, sửa, xoá được hết**:

| Bảng | Dùng cho |
|---|---|
| `sales_fact` | 2.839 dòng đơn hàng Shopee — nguồn của MỌI con số doanh thu |
| `dataset` · `snapshot` | dữ liệu và ảnh chụp của dashboard cũ |
| `ads_plan` · `ads_keyword` | kế hoạch quảng cáo |
| `product_design_plan` | kế hoạch thiết kế sản phẩm |

Nặng nhất: `index.html:4918` gọi `DELETE /rest/v1/<bảng>?_id=gte.0` rồi nạp lại
— tức là **app cũ cần quyền xoá sạch bảng bằng khoá anon** thì nút *Import data*
mới chạy. Không phải ai quên bật RLS: kiến trúc app cũ dựa vào chỗ hở này.

## Vì sao chưa sửa ngay

Khoá lại là gãy app cũ đang chạy production (Import data, lưu kế hoạch ads, kế
hoạch thiết kế). Đây là đánh đổi thuộc quyền quyết định của anh Louis, không
phải lỗi kỹ thuật sửa là xong.

## Ba hướng

1. **Chuyển ghi sang Edge Function.** App cũ không ghi thẳng REST nữa mà gọi một
   Edge Function giữ `service_role` phía máy chủ. Sau đó tắt hẳn quyền ghi của
   `anon`. Đúng nhất, tốn công nhất.
2. **Bỏ tính năng ghi ở app cũ.** Nếu Import data và hai bảng kế hoạch không còn
   ai dùng — app v2 nạp dữ liệu bằng GitHub Actions với `service_role` — thì chỉ
   cần khoá `anon` về `select`. Rẻ nhất, cần xác nhận không ai còn dùng.
3. **Giữ nguyên, chấp nhận rủi ro.** Chỉ hợp lý nếu link app cũ thật sự không ai
   ngoài công ty biết. Lưu ý repo đang public nên GitHub search tìm ra được.

App v2 không làm tình hình xấu thêm: nó dùng cùng khoá anon đó, mà khoá thì đã
công khai sẵn từ app cũ. Bảng `v2_` của app mới đã khoá đúng ngay từ đầu.

## SQL để xem hiện trạng (chỉ đọc, chạy trong Supabase SQL Editor)

```sql
select tablename, rowsecurity as rls_bat
from pg_tables where schemaname = 'public' order by rowsecurity, tablename;

select tablename, policyname, cmd, roles
from pg_policies where schemaname = 'public' order by tablename;

select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
order by table_name, privilege_type;
```
