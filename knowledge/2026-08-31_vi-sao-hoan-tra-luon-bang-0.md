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

## KẾT LUẬN CUỐI (sau khi chạy sync 600 ngày, anh Louis duyệt)

```
mode: sync · period_days: 600 · stopped_by_budget: false
returns_found: 0
```

> ⚠️ **CÂU DƯỚI ĐÂY LÀ KẾT LUẬN SAI. Giữ lại để thấy chỗ chệch.**
> *"Shopee Returns API không có một bản ghi trả hàng nào cho shop này, suốt 600
> ngày."*
>
> Sai ở chỗ biến **"gọi mà không nhận được gì"** thành **"bên đó không có gì"**.
> Bằng chứng chỉ chứng minh được điều thứ nhất. Xem VÒNG 4 ở cuối file: Louis
> gửi ảnh Seller Center một đơn hoàn thật, và cửa sổ phủ đúng ngày đó ĐÃ được
> gọi mà vẫn trả rỗng — tức API có dữ liệu, tầng nạp hỏi sai cách.

10 lời gọi `get_return_list` đều trả về rỗng. Quét trọn, không bị cắt vì hết
giờ. Quyền vẫn `ok: true`.

Sau khi chạy, dòng `260826D5UYEMQ8` **không đổi một chữ** — đúng như dự đoán, vì
`returns_found = 0` thì nhánh ghi không chạy. Bằng chứng còn nguyên.

### Đối chiếu bằng tiền ký quỹ

Nếu 726.750 đ đã thật sự được hoàn thì tiền ký quỹ phải về gần 0. Thực tế:

| | |
|---|---|
| Giá bán | 726.750 đ |
| Tiền ký quỹ Shopee đã trả | **501.572 đ** |
| Tỷ lệ ký quỹ / giá bán | **0,690** |
| Trung vị 1.646 đơn hoàn thành | 0,755 |

Thấp hơn trung vị một chút nhưng **nằm trong khoảng bình thường** (dải từ −0,197
đến 13,539). Tiền đã được chi trả — **không có dấu hiệu hoàn toàn bộ**.

### Vậy con số 0 là ĐÚNG hay SAI?

**Đúng theo API, nhưng thiếu.** Không app nào sai số liệu: Shopee không báo có
hàng hoàn thì cả hai app đều ra 0, và tiền cũng đã về. Nhưng Seller Center có
ghi một yêu cầu trả **đã chấp thuận** mà Returns API không liệt kê. Hai nguồn
của chính Shopee không khớp nhau.

Ba khả năng còn lại, **chỉ người có tài khoản Seller Center kiểm được**:

1. Yêu cầu đã duyệt nhưng khách **chưa gửi hàng về** — chưa phát sinh bản ghi trả.
2. Là **hoàn tiền một phần**, Shopee xếp ngoài `get_return_list`.
3. Trạng thái trong file Excel đã cũ, yêu cầu về sau bị huỷ.

→ **Việc cần làm: mở đơn `260826D5UYEMQ8` trong Seller Center xem trạng thái
thật.** Không có đường nào khác để phân định từ phía dữ liệu.

### Mức ảnh hưởng

Tối đa 726.750 đ trên 1.938,7 triệu doanh thu — **0,04%**, và nhiều khả năng
bằng 0 vì tiền đã về đủ. Không phải vấn đề số liệu. Vấn đề là **hệ thống chỉ
biết hàng hoàn qua một cột mà API chưa từng điền**, cộng với lỗi tên trường đang
chờ sẵn. Ngày nào tỷ lệ hoàn tăng, cả hai chỗ này cùng bung.

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

---

# VÒNG 4 — Tìm ra nguyên nhân thật: `page_no` đánh số từ 0

Anh Louis gửi ảnh Seller Center một đơn hoàn thật. Đây là mảnh ghép cuối.

## Đơn đối chứng

Đơn `260807NEUMCNE3` · yêu cầu trả `26081104HVP2T4M` · tạo 11/08/2026
4 × Chăn Lạnh ExtraCool · **Đã hoàn tiền cho Người mua: 280.560 đ** · lý do *Đổi ý*

| | Seller Center | `sales_fact` | App v2 tính |
|---|---|---|---|
| Trạng thái | Trả hàng & Hoàn tiền, **đã hoàn tiền** | `Hoàn thành` | không huỷ |
| Trạng thái trả/hoàn | có mã yêu cầu trả | **`None`** | — |
| Số lượng hoàn | 4 sản phẩm | **`'0'`** cả 4 dòng | — |
| Tiền hoàn | **280.560 đ** | không có cột nào giữ | **hoàn = 0** |
| Ký quỹ | — | **−20.880** (âm) | — |
| Doanh thu ghi nhận | thực tế ≈ 0 | — | **309.259 đ** |

## Nguyên nhân: lệch một chỉ số trang

`ops-sync/index.ts`, vòng lặp returns:

```js
let page = 1, more = true;              // ← SAI
while (more && !outOfTime()) {
  const j = await get("/api/v2/returns/get_return_list", shopId, token, {
    page_no: page, page_size: 50, create_time_from: from, create_time_to: to,
  });
```

**Returns API của Shopee đánh số trang từ 0.** Bắt đầu ở `page = 1` nghĩa là lời
gọi ĐẦU TIÊN đã hỏi **trang thứ hai**. Shop có dưới 50 đơn trả trong mỗi cửa sổ
14 ngày, nên trang thứ hai luôn rỗng, `more` về `false`, vòng lặp thoát ngay.

Khớp trọn mọi quan sát trước đó, không còn chỗ nào hở:

| Quan sát | Giải thích |
|---|---|
| quyền `ok: true` | quyền thật sự có |
| `{"more": false, "return": []}` | đúng hình dạng của một trang vượt quá cuối |
| `returns_found: 0` cả 600 ngày | mọi cửa sổ đều hỏi trang 2 |
| `returns` vắng ở `shopee_api_fact` | `safeRaw` nằm trong vòng lặp, không bao giờ chạy tới |
| Excel có trạng thái, API không | Excel là nguồn duy nhất từng biết về đơn trả |

Lỗi tương tự ở chế độ `probe`, dòng 409: `page_no: 1`.

**Đã vá cả hai chỗ về `0`. CHƯA TRIỂN KHAI** — cần anh Louis duyệt vì là đẩy code
lên Edge Function production.

## Cách dò tạm không cần Returns API

Đơn `260807NEUMCNE3` **nằm trong danh sách 86 đơn ký quỹ âm** đã lập ở
`output/hoan-tra-tu-api.xlsx` sheet 4. Tức là **cột `tien_ky_quy` âm đã bắt được
đơn hoàn thật mà không cần Returns API** — tín hiệu này có sẵn trong database từ
trước. Đây là cách dò dùng được ngay, trong lúc chờ vá.

## Thứ tự sửa sau khi có kết luận này

1. Triển khai bản vá `page_no` → `returns_found` sẽ ra số thật.
2. Triển khai bản vá `item.amount` + cột `so_tien_hoan` (đã viết ở vòng 2) —
   không có nó thì dù tìm được đơn trả, số lượng vẫn ghi 0.
3. Chạy `sync` lùi 600 ngày, đối chiếu đơn `260807NEUMCNE3` phải ra 4 sản phẩm
   hoàn và 280.560 đ.
4. Bàn với anh Louis về `revenue_rules.py`: dùng gì để trừ hoàn trả — số lượng
   hoàn, `seller_return_refund`, hay ký quỹ âm. Đây là quyết định kế toán, và
   sửa là doanh thu CẢ HAI app cùng giảm.
