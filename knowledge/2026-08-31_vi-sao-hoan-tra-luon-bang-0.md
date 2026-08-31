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

## Chỗ tôi CHƯA kiểm được

Hai bảng lưu nguyên văn phản hồi API đều chặn khoá anon (401):

- `shopee_api_fact` — nơi `saveRaw()` lưu JSON gốc Shopee trả về
- `shopee_sync_checkpoint` — nơi ghi endpoint nào bị `blocked` vì thiếu quyền

Vì vậy **chưa xác nhận được** hai điều, cần khoá service role hoặc SQL Editor:

1. Nhánh returns có chạy thật không, hay bị chặn quyền ngay từ đầu. Đáng ngờ:
   giá trị `"Đã Chấp Thuận Yêu Cầu"` là nhãn **tiếng Việt của Seller Center**,
   tức đến từ file Excel xuất tay; API trả mã tiếng Anh (`ACCEPTED`…). Nếu nhánh
   API có chạy thì đã ghi đè bằng mã tiếng Anh rồi.
2. Tên trường chính xác trong phản hồi thật. Tôi suy ra `amount` và
   `refund_amount` từ tài liệu Shopee Open API v2 và từ chính đoạn mã, **chưa
   đối chiếu với JSON thật**.

```sql
-- chạy trong Supabase SQL Editor để chốt hai điều trên
select module, endpoint, status, rows_synced, last_attempt_at
from public.shopee_sync_checkpoint where module = 'returns';

select endpoint, scope_key, payload
from public.shopee_api_fact where module = 'returns'
order by fact_date desc limit 5;
```

## Đề xuất sửa — theo thứ tự

**Bước 1 — xác minh** (bắt buộc trước khi sửa code): chạy hai câu SQL trên. Nếu
`status = 'blocked'` thì gốc rễ là **thiếu quyền API**, sửa tên trường vô ích.

**Bước 2 — sửa hàm đồng bộ**: đọc `x.amount` cho số lượng, và thêm cột
`so_tien_hoan` lưu `ret.refund_amount`. Không dồn tiền hoàn vào `phi_tra_hang`.

**Bước 3 — sửa công thức doanh thu**: đây là chỗ **phải cân nhắc kỹ**.
`revenue_rules.py` dùng chung với app cũ đang chạy production, sửa là **cả hai
app đổi số cùng lúc**. Đổi cách trừ hoàn trả sẽ làm doanh thu mọi kỳ giảm đi.
Việc này cần anh duyệt, không phải quyết định kỹ thuật.

**Bước 4 — nạp lại** và đối chiếu: đơn `260826D5UYEMQ8` phải hiện hoàn trả
726.750 đ (hoặc số Shopee thật sự hoàn), không còn tính đủ doanh thu.

## Mức ảnh hưởng hiện tại

Đúng 1 đơn, 726.750 đ trên tổng doanh thu 1.938,7 triệu — khoảng **0,04%**. Nhỏ.
Nhưng đây là lỗi **hệ thống, không phải lỗi số liệu**: hàng hoàn tăng bao nhiêu
thì app cũng vẫn báo 0. Phải sửa trước khi tỷ lệ hoàn tăng lên.
