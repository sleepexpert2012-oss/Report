# v2 — tầng dữ liệu của app mới

Dựng từng phần. App cũ (`../index.html`) vẫn chạy production, không bị đụng tới.

## ⚠ Giao diện đã dọn sang repo riêng

Thư mục `v2/app/` **không còn ở đây**. Từ 30/8/2026 nó là repo riêng:

- Mã nguồn: https://github.com/sleepexpert2012-oss/se-data-app
- Link chạy thật: https://sleepexpert2012-oss.github.io/se-data-app/
- Ở máy: `16. AI/SE Data App/`

Lịch sử 7 commit được mang sang nguyên vẹn bằng `git subtree split`, và lịch sử
cũ vẫn còn trong repo này — không mất gì.

**Vì sao chỉ tách giao diện, không tách cả `ingest/`:** tầng nạp `import`
`../scripts/revenue_rules.py` — nguồn sự thật duy nhất về doanh thu và giá vốn,
dùng chung với app cũ. Sao chép module đó sang repo khác là mở đường cho hai bản
trôi lệch nhau, nên nó ở lại đây cạnh `scripts/`.

## Đã có

### Tầng nạp dữ liệu (L1)

Nhận file Excel → kiểm tra ba lớp → xuất bản ghi sạch. Chưa ghi vào database.

```bash
cd v2
python3 -m ingest.cli --hop-dong contracts/sku-master.yaml \
                      --file "../data-goc/upload-erp/Sleep Expert — Data Model (Star Schema).xlsx"
```

Thêm `--json <đường dẫn>` để ghi các bản ghi đã nhận ra file.

```bash
cd v2 && python3 -m tests.test_validate
```

Hai hợp đồng đang có: `contracts/sku-master.yaml` (sheet *1. Master Data*, 143 SKU) và
`contracts/supplier.yaml` (sheet *0. Mã Supplier*, 6 nhà cung cấp).

### Tầng kho (L3)

Schema ở `v2/supabase/migrations/20260830_v2_master.sql` — **chạy tay trong Supabase SQL Editor**
vì CLI của tài khoản hiện tại bị chặn quyền 403 (đã ghi trong `BAN-GIAO-TAI-KHOAN-MOI.md`).

Mọi bảng mang tiền tố `v2_` nên không đụng bảng nào của app đang chạy.

```bash
# xem trước, không ghi gì — in luôn bảng so sánh với lô đang dùng
cd v2 && python3 -m ingest.load --file "../data-goc/upload-erp/Master Data (them cot Brand).xlsx" --dry-run

# ghi thật (cần SUPABASE_SERVICE_ROLE_KEY trong biến môi trường)
cd v2 && python3 -m ingest.load --file "..." --nguoi-nap "Louis" --kich-hoat
```

**Nạp theo lô, có đường lùi.** Mỗi lần nạp là một lô mới; lô cũ giữ nguyên. App chỉ đọc lô
đang kích hoạt qua khung nhìn `v2_sku_hien_hanh`. Nạp nhầm thì kích hoạt lại lô trước, không mất gì.
Database có ràng buộc chỉ cho đúng một lô kích hoạt tại một thời điểm — không phụ thuộc code nhớ hay quên.

Trước khi ghi, lệnh luôn in bảng so sánh: mã nào thêm, mã nào mất, trường nào đổi giá trị
(giá vốn, giá bán, lead time, MOQ, ABC, brand, nhà cung cấp, ngành hàng).

## Nguyên tắc

**Luật nghiệp vụ nằm ở `contracts/*.yaml`, không nằm trong code.** Đổi luật nạp thì sửa
file YAML, không sửa Python. File YAML viết bằng tiếng Việt để người phụ trách dữ liệu
đọc và sửa được mà không cần lập trình.

**Tầng nạp ghi thô, không diễn giải.** Ô ghi `8/10` (gối hai gờ) được giữ nguyên là chuỗi;
việc tách thành cao_min/cao_max thuộc tầng chuẩn hoá phía sau. Nhờ vậy khi số liệu sai còn
biết chắc sai ở khâu đọc hay khâu diễn giải.

**Không bao giờ tự sửa dữ liệu của người dùng.** Chỉ có ba kết cục: nhận, loại (nói rõ dòng
nào và vì sao), hoặc cảnh báo. Không có "tự đoán rồi ghi đại".

## Ba lớp kiểm tra

| Lớp | Bắt cái gì | Hậu quả |
|---|---|---|
| 1 · Định dạng | thiếu cột bắt buộc · **tiêu đề trùng tên mà chưa ghim cột** · cột bị dịch chỗ | **chặn cả file**, không nạp dòng nào |
| 2 · Nội dung | thiếu khoá · khoá trùng · ô sai kiểu | loại dòng, hoặc để trống ô đó |
| 3 · Liên kết chéo | brand lạ · mã NCC ứng nhiều tên · thiếu giá vốn · thiếu lead time | cảnh báo, vẫn nạp |

Lớp 1 tồn tại vì một lý do cụ thể: sheet SKU có **hai cột cùng tên "Brand"** (cột E là brand
thật, cột N là tên nhà cung cấp). Bản nạp cũ lấy nhầm, dẫn tới bảng `dim_brand` trên Supabase
chứa danh sách nhà cung cấp. Nay hệ thống từ chối đoán: gặp tiêu đề trùng thì chặn và bắt
hợp đồng ghi rõ lấy cột nào.

## Kết quả chạy trên master mới (30/08/2026)

File: `data-goc/upload-erp/Master Data (them cot Brand).xlsx` · sheet `1. Master Data`

```
Đọc được 151 · Nhận 143 · Loại 8
```

- 8 dòng bị loại là dòng rác cuối bảng: công thức trả về `0` ở cột SKU, không phải sản phẩm.
- Không còn cảnh báo lệch ánh xạ nhà cung cấp (bản cũ có 53 dòng).
- Luật brand `anh_xa_khai_bao` không báo dòng nào — 143/143 đúng luật.
- Còn 2 cảnh báo đúng thực tế: 60 SKU chưa có giá vốn (đều là SKU chưa từng mua, chưa bán),
  142 SKU thiếu lead time.

Bản ghi sạch xuất ra `v2/output/master-sku.json`: 143 SKU · brand `TUFT & NEEDLE` 109 /
`POWER X` 34 · 6 nhà cung cấp · 5 ngành hàng.

## Quy chuẩn giao diện

Louis chốt ngày 30/08/2026: **hướng 1 · Chàm chuẩn**. Toàn bộ luật ở
[`v2/design/DESIGN-SYSTEM.md`](design/DESIGN-SYSTEM.md); nơi cài đặt duy nhất là khối `:root`
trong `v2/app/src/styles.css`.

- Màu gốc `#353E99` đo bằng cách đếm điểm ảnh trên logo công ty (87,7% diện tích), tương phản 9,13:1.
- Chữ: **Be Vietnam Pro** cho giao diện, **IBM Plex Mono** cho mã và số.
- Màu biểu đồ `#5560CC #12A08D #C77A14 #C0435C #8A5BD6` đã qua bộ kiểm tra 5 mục của skill `dataviz`.
- Biểu tượng SVG nét vẽ tại `src/icons.tsx`, không dùng emoji.

Hai trang dùng để chọn hướng vẫn giữ để tra cứu:
`design/huong-dan-giao-dien.html` (thang chữ · bảng màu · tương phản) và
`design/tong-quan-5-huong.html` (màn Tổng quan đủ biểu đồ, số liệu thật).

## Skill dùng khi dựng app này

Cài ngày 30/08/2026 từ marketplace `tanstack-skills` (MIT, chỉ chứa `.md` + `.json`, đã quét: không có
script/hook nào):

| Skill | Dùng cho |
|---|---|
| `tanstack-table` | bảng dữ liệu — sort, lọc, gom nhóm, xổ cây, ghim cột (thay `renderTable` của app cũ) |
| `tanstack-query` | gọi và cache dữ liệu Supabase, đồng bộ nhiều màn |
| `tanstack-virtual` | cuộn ảo cho bảng SKU dài |

Đã có sẵn từ trước, dùng chung: `backend-dev:supabase`, `supabase-postgres-best-practices`,
`design:ui-ux-pro-max`, `frontend-design`, `design-system`, `ui-styling`, `mengto-tailwindcss`,
`dataviz` (built-in), `supply-chain:*`, `devops:playwright`, `security:*`, `code-review`.

## Giao diện (v2/app)

Vite + React + TypeScript. Chạy:

```bash
npm run dev --prefix v2/app     # http://localhost:5173
```

Dữ liệu màn Master Data hiện đọc từ `v2/app/public/data/master-sku.json` — bản do lớp nạp
sinh ra. Khi tầng kho (L3) xong sẽ chuyển sang đọc Supabase.

### Màn đã dựng

**Master Data** — danh mục 143 SKU. Phần tử đặc trưng là **dải hoàn thiện**: mỗi dòng có sáu
ô nhỏ cho sáu trường quyết định một SKU đã khai báo xong hay chưa (giá vốn · giá bán ·
lead time · MOQ · ABC · ID Shopee). Đặc là có, rỗng là thiếu — nhìn dọc trang thấy ngay
hoa văn độ đầy đủ của cả danh mục, không phải mở từng dòng ra dò.

Ô "Giá vốn" theo đúng `docs/QUY-TAC-DOANH-THU.md`: có `Unit Cost (VND)` **hoặc**
`Giá vốn (+VAT)` là tính đủ.

Đã kiểm chứng trên trình duyệt: dải hoàn thiện khớp dữ liệu gốc **143/143 dòng, 0 lệch**;
bảy giá trị của bộ lọc "Còn thiếu" khớp tuyệt đối số đếm từ dữ liệu; sắp xếp tăng/giảm đúng.

Bộ lọc "Còn thiếu" ban đầu thiết kế là nút bật/tắt "chỉ hiện SKU còn thiếu" — bỏ đi vì
**không SKU nào đủ cả sáu trường**, nút đó lọc ra đúng 143 dòng nên vô nghĩa. Thay bằng ô
chọn theo từng trường.

## Chưa có

Tầng ghi vào kho (L3), tầng chuẩn hoá nghiệp vụ (L2), và 7 màn còn lại. Làm lần lượt,
mỗi màn duyệt xong mới sang màn kế.
