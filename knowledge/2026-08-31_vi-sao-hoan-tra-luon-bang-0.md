# Vì sao Hoàn trả luôn bằng 0 — và tại sao lỗi này ở tầng nạp, không phải ở Shopee

Ngày: 31/8/2026 · Do anh Louis chỉ ra: *"trong API có mục ghi hoàn tiền rõ ràng"*

## Kết luận ngắn

Anh đúng. Shopee **có** trả dữ liệu hoàn. Hàm đồng bộ **có** gọi đúng endpoint.
Nhưng nó đọc sai tên trường nên số lượng hoàn luôn ra 0, và nó **không hề lưu**
số tiền hoàn. Công thức doanh thu lại chỉ trừ hoàn trả theo đúng cái số 0 đó.

Đính chính một điều tôi từng nói sai trong app: câu *"Shopee chưa trả số lượng
hoàn"* là **sai**. Đã sửa thành đúng nguyên nhân.

Một điều nữa cần nói rõ: **app cũ cũng ra 0**, không lấy được số liệu này. Tôi
mở P&L của app cũ và đọc trực tiếp:

```
(−) Hoàn trả thực tế    0,0  0,0%   0,0  0,0%   0,0  0,0%   0,0  0,0%
```

Cả hai app dùng chung `scripts/revenue_rules.py` nên không thể khác nhau.

## Chuỗi nhân quả

**1. Công thức chỉ nhìn đúng một cột** — `scripts/revenue_rules.py:99`

```python
returned_qty = min(qty, max(0.0, number(row.get("so_luong_san_pham_duoc_hoan_tra"))))
```

Hoàn trả chỉ được trừ khi cột này > 0. Không có đường nào khác.

**2. Cột đó rỗng toàn bộ.** Quét cả 2.839 dòng `sales_fact`:

| Cột | Có giá trị |
|---|---|
| `so_luong_san_pham_duoc_hoan_tra` | **0 / 2.839** |
| `phi_tra_hang` | **0 / 2.839** |
| `shopee_xu_duoc_hoan` | **0 / 2.839** |
| `trang_thai_tra_hang_hoan_tien` | 1 / 2.839 |

**3. Nhưng hàng hoàn là có thật.** Đúng một đơn:

| | |
|---|---|
| Mã đơn | `260826D5UYEMQ8` |
| Trạng thái trả/hoàn | **Đã Chấp Thuận Yêu Cầu** |
| SKU | `BLA001008` · 1 cái · 726.750 đ |
| Số lượng hoàn đang lưu | `"0"` |

Đơn này **đang được tính đủ doanh thu** dù Shopee đã duyệt trả.

**4. Hàm đồng bộ có gọi đúng API** — `supabase/functions/ops-sync/index.ts:336`

```
/api/v2/returns/get_return_list
/api/v2/returns/get_return_detail
/api/v2/returns/get_reverse_tracking_info
```

**5. Nhưng đọc sai tên trường** — cùng file, quanh dòng 355:

```js
const qty = (ret.item || ret.item_list || []).reduce((s, x) =>
  s + Number(x.refund_quantity || x.quantity || x.model_quantity_purchased || 0), 0);

await sb.from("sales_fact").update({
  trang_thai_tra_hang_hoan_tien: String(ret.status || ret.return_status || "Có yêu cầu trả/hoàn"),
  so_luong_san_pham_duoc_hoan_tra: String(qty),
  phi_tra_hang: String(ret.return_shipping_fee || ret.amount || 0),
}).eq("ma_don_hang", sn);
```

Hai lỗi trong đoạn này:

- **Số lượng:** trong `get_return_list`, mỗi phần tử `item` mang số lượng ở
  trường `amount`. Ba tên đang dò (`refund_quantity`, `quantity`,
  `model_quantity_purchased`) đều không có → `Number(undefined || 0)` = 0 →
  luôn ghi `"0"`.
- **Số tiền hoàn:** bản ghi trả hàng có sẵn `refund_amount` — chính là *"mục ghi
  hoàn tiền rõ ràng"* anh nói. Đoạn này **không đọc nó**. Nó lấy
  `ret.return_shipping_fee || ret.amount` rồi nhét vào `phi_tra_hang` — cột dành
  cho *phí* trả hàng, không phải *tiền* hoàn. Hai khái niệm khác nhau bị dồn vào
  một cột, mà rồi cũng không ai đọc.

## ĐÍNH CHÍNH sau khi kiểm được (31/8/2026, chạy trong SQL Editor + probe)

Phần trên viết khi chưa đọc được bảng thô. Đã kiểm xong, và **nguyên nhân trực
tiếp KHÁC với chẩn đoán ban đầu**. Giữ nguyên phần trên để thấy chỗ tôi suy sai.

**1. Quyền API KHÔNG bị chặn.** Gọi `ops-sync` chế độ `probe` (chỉ đọc):

```
payment   → ok: true
logistics → ok: true
returns   → ok: true,  response: {"more": false, "return": []}
```

**2. Nhưng Shopee trả về danh sách trả hàng RỖNG** cho cửa sổ 14 ngày gần nhất.

**3. Nhánh returns chưa từng chạy tới thân vòng lặp.** Cả hai bảng đều không có
module `returns`:

| bảng | các module có mặt |
|---|---|
| `shopee_sync_checkpoint` | ads *(blocked)* · affiliate · logistics · order · payment · product · shop · video |
| `shopee_api_fact` | ads · affiliate · logistics · order · payment · product · shop · video |

`safeRaw("returns", …)` nằm **bên trong** `for (const ret of returnRows)`. Danh
sách rỗng thì vòng lặp không chạy, nên không có bản ghi nào — đúng như quan sát.

**4. Vậy giá trị đang nằm trong `sales_fact` đến từ file Excel, không từ API.**
Củng cố thêm: `"Đã Chấp Thuận Yêu Cầu"` là nhãn **tiếng Việt của Seller Center**;
API trả mã tiếng Anh. Nếu nhánh API từng chạy thì đã ghi đè bằng mã tiếng Anh.

### Nghĩa là

Lỗi tên trường tôi tìm ra ở phần trên **là lỗi thật, nhưng chưa từng gây hại** —
nó chưa bao giờ được chạy tới. Nó là **mìn chờ**: ngày nào Shopee trả về một đơn
hoàn, số lượng sẽ vẫn ra 0 và tiền hoàn vẫn không được lưu. Vá là đúng, nhưng vá
xong **cũng chưa làm hoàn trả hiện lên**.

### Câu hỏi còn lại

Vì sao Shopee không liệt kê đơn `260826D5UYEMQ8` trong Returns API, trong khi
Seller Center ghi *"Đã Chấp Thuận Yêu Cầu"*? Ba khả năng, chưa phân định được:

1. `probe` chỉ hỏi **14 ngày gần nhất**; yêu cầu trả có thể tạo sớm hơn.
2. Đây là **hoàn tiền không trả hàng** — Shopee xếp loại khác, có thể không nằm
   trong `get_return_list`.
3. Trạng thái trong file Excel đã cũ hoặc mang nghĩa khác với API.

Muốn phân định phải quét cửa sổ dài hơn, tức chạy `ops-sync` chế độ `sync` —
**ghi vào `sales_fact` production**, nên chờ anh Louis duyệt.

## Đề xuất sửa — theo thứ tự

**Bước 1 — ĐÃ XONG.** Quyền không bị chặn; danh sách trả hàng rỗng. Xem phần
đính chính ở trên.

**Bước 2 — ĐÃ VÁ, CHƯA TRIỂN KHAI.** Đọc `x.amount` cho số lượng, thêm cột
`so_tien_hoan` lưu `ret.refund_amount`. Đây là gỡ mìn chờ, không phải cách làm
hoàn trả hiện lên ngay.

**Bước 3 — sửa công thức doanh thu**: đây là chỗ **phải cân nhắc kỹ**.
`revenue_rules.py` dùng chung với app cũ đang chạy production, sửa là **cả hai
app đổi số cùng lúc**. Đổi cách trừ hoàn trả sẽ làm doanh thu mọi kỳ giảm đi.
Việc này cần anh duyệt, không phải quyết định kỹ thuật.

**Bước 4 — quét cửa sổ dài** (`mode: "sync"`, ghi vào production, cần duyệt) để
biết Shopee có bản ghi trả hàng cho đơn `260826D5UYEMQ8` hay không. Nếu KHÔNG
có, thì nguồn duy nhất biết về đơn hoàn này là file Excel — và tầng nạp phải đọc
`trang_thai_tra_hang_hoan_tien` từ Excel, chứ không thể trông vào API.

## Mức ảnh hưởng hiện tại

Đúng 1 đơn, 726.750 đ trên tổng doanh thu 1.938,7 triệu — khoảng **0,04%**. Nhỏ.
Nhưng đây là lỗi **hệ thống, không phải lỗi số liệu**: hàng hoàn tăng bao nhiêu
thì app cũng vẫn báo 0. Phải sửa trước khi tỷ lệ hoàn tăng lên.
