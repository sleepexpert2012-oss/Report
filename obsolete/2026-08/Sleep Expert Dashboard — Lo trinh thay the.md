# Sleep Expert — SKU Performance Console
## Lộ trình thay thế dashboard (từ bản VuaNem)

*Phòng Supply Chain — Sleep Expert · Tài liệu nội bộ · v0.1 (draft)*
*Nguồn tham chiếu: `VuaNem_Dashboard (3).html` — SKU Performance Console, Phòng Sourcing.*

---

## 1. Tóm tắt định hướng

Dashboard gốc là một file **HTML self-contained** (~1,9 MB, nhúng sẵn Chart.js + SheetJS + toàn bộ dữ liệu build). Nó **không phải là web app có backend** — mọi thứ chạy trong trình duyệt, dữ liệu build được nhúng cứng, và người dùng có thể import file Excel tháng mới ngay trong phiên.

Điều quan trọng nhất: kiến trúc chia làm **3 lớp tách biệt**. Chiến lược thay thế xoay quanh việc *giữ lớp nào, viết lại lớp nào*:

| Lớp | Vai trò trong file gốc | Với Sleep Expert |
|---|---|---|
| **Lớp 1 — Nạp dữ liệu** | Hàm `parseNetsuite()` đọc file NetSuite `.xlsx`, dò 2 hàng header, gom SKU theo tháng | **VIẾT LẠI** — ERP của SE khác cấu trúc export |
| **Lớp 2 — Mô hình & mapping** | Đối tượng `RAW` (star schema: mảng dimension + fact rows tham chiếu theo chỉ số), `CAT`, quy tắc nghiệp vụ (gộp brand, phân khúc, leadtime, ROP) | **CẤU HÌNH LẠI** — danh mục brand/class/ngành + quy tắc của SE khác hoàn toàn |
| **Lớp 3 — Phân tích & hiển thị** | 11 trang, biểu đồ Chart.js, drill-down, modal Class Explorer | **GIỮ ~NGUYÊN** — chỉ đổi nhãn, nhận diện, một số công thức |

> **Nguyên tắc vàng:** chèn một **schema chuẩn hóa trung gian** (data contract) giữa Lớp 1 và Lớp 2. Bất kể ERP của SE là gì, đầu ra của Lớp 1 luôn khớp schema này → Lớp 2 và 3 không cần biết ERP nào. Đây là thứ giúp việc thay thế bền vững và dễ bảo trì.

---

## 2. Bản đồ tính năng cần tái tạo (11 trang)

1. **Tổng quan kinh doanh** — KPI, sparkline, DT/GP/GM% toàn công ty
2. **Ngành hàng** — theo nhóm (Nệm / Chăn ga / Gối / Phụ kiện / Ngành khác)
3. **Range Review** — rà soát dải sản phẩm
4. **Ma trận sản phẩm** — ma trận phân loại
5. **Phân tích Chăn** *(đặc thù VuaNem — SE có thể thay bằng ngành hàng riêng)*
6. **Sản phẩm mới ra mắt** — theo năm
7. **Bảng xếp hạng sản phẩm** — theo kỳ (tháng/quý/6T/năm)
8. **Class Explorer** — modal drill-down chi tiết từng class (hiệu quả KD, tồn kho, demand planning, vị trí thị trường)
9. **Quản trị Tồn kho & Kế hoạch đặt hàng** — ROP theo SKU, service level, leadtime
10. **Forecast & Kế hoạch đặt hàng (S&OP)** — dự báo H2, drill-down Ngành→Brand→Class→SKU
11. **Changelog** — nhật ký phiên bản

---

## 3. Lộ trình 6 giai đoạn

### Giai đoạn 0 — Khảo sát dữ liệu & danh mục *(1–2 ngày)*
Mục tiêu: hiểu ERP và catalog của SE trước khi viết một dòng code.

- Lấy **1 file export mẫu** từ ERP của SE, đủ mọi cột, ít nhất 2–3 tháng dữ liệu.
- Liệt kê danh mục thực tế của SE: **ngành hàng, loại hình, class, brand, phân khúc giá, kênh bán, chất liệu**.
- Chốt các **quy tắc nghiệp vụ** đặc thù SE (thay cho quy tắc VuaNem như iComfy→Comfy, Doona→Amando, loại "hàng mẫu"/mã M): SE gộp/loại/đổi tên gì?
- Chốt dữ liệu **tồn kho đầu kỳ** + ngày cắt tồn + **leadtime** theo brand/nguồn cung + **service level** mục tiêu.

**Đầu ra:** file "Data Contract & Import Template" (kèm theo) được điền đầy đủ.

### Giai đoạn 1 — Kiến trúc & Data contract *(2–3 ngày)*
- Thiết kế **schema chuẩn hóa trung gian** (star schema: dimensions + fact rows) — *đã có bản nháp trong file Excel kèm theo*.
- Bóc tách file gốc thành 3 file/nhánh làm việc: `ingest.js` (Lớp 1), `model+config.js` (Lớp 2), phần render (Lớp 3).
- Định nghĩa **bảng ánh xạ cột**: cột ERP của SE → trường trong schema chuẩn.

**Đầu ra:** data contract chốt + sơ đồ luồng dữ liệu.

### Giai đoạn 2 — Nhận diện & khung *(1 ngày)*
- Đổi **logo, màu chủ đạo, tên, footer, mật khẩu truy cập** (màn hình `.gbox`), tiêu đề trang.
- Thay mọi nhãn cứng "Vua Nệm" / "Phòng Sourcing" → "Sleep Expert" / "Supply Chain".
- Khởi tạo **changelog v1** cho bản SE.

**Đầu ra:** shell HTML mang nhận diện SE (chưa có data thật).

### Giai đoạn 3 — Viết lại Lớp 1 (parser ERP của SE) *(3–5 ngày)*
- Viết `parseSE()` thay `parseNetsuite()`: đọc file export của SE, map cột → schema chuẩn.
- Cài **quy tắc nghiệp vụ SE** (gộp brand, loại SP ngưng bán, mã loại trừ, chuẩn hóa tên).
- Hỗ trợ 2 chế độ **Thay toàn bộ / Chỉ thêm tháng mới** như bản gốc.
- Test round-trip: import file mẫu → đối chiếu tổng DT/GP/Unit với báo cáo ERP.

**Đầu ra:** import chạy được với file thật của SE.

### Giai đoạn 4 — Cấu hình Lớp 2 (mô hình & mapping) *(2–3 ngày)*
- Nạp **dimensions/CAT** của SE (ngành, loại hình, class, brand, phân khúc, kênh, chất liệu).
- Cấu hình **thuộc tính cấp class**: nhãn vòng đời (Mới/In-line/Phase-out/Suy giảm/Ngưng bán), phân khúc, vai trò SP mới, SP thay thế, first-sale, mùa vụ.
- Kiểm 11 trang render đúng với dữ liệu SE (nhãn, nhóm, màu).

**Đầu ra:** toàn bộ trang hiển thị đúng theo catalog SE.

### Giai đoạn 5 — S&OP / Tồn kho / Forecast *(3–4 ngày)*
- Cấu hình **leadtime, service level, ROP theo SKU** cho SE (thay tham số VuaNem: LT 30 ngày, SL 99%…).
- Nạp **tồn kho đầu kỳ**; chọn phương pháp **forecast** (lịch sử + mùa vụ, hệ số NCC ×1,15… điều chỉnh theo SE).
- Validate công thức: `GM = GP/DT`, `DT bán = COGS ÷ (1−GM)`, ROP class = Σ ROP SKU.

**Đầu ra:** tab tồn kho & forecast cho số liệu hợp lý, đối chiếu được.

### Giai đoạn 6 — QA, đối chiếu & bàn giao *(2–3 ngày)*
- **Đối chiếu chéo**: tổng DT/GP/Unit của dashboard vs báo cáo tài chính/ERP của SE (sai số < ngưỡng chấp nhận).
- Test import tháng mới (append) và thay toàn bộ (replace).
- Viết **hướng dẫn sử dụng** + cập nhật changelog.
- Đóng gói **1 file HTML self-contained** để phát hành nội bộ.

**Đầu ra:** Sleep Expert — SKU Performance Console v1.0.

---

## 4. Ước lượng tổng thể

| Giai đoạn | Thời lượng | Phụ thuộc |
|---|---|---|
| 0 — Khảo sát | 1–2 ngày | File ERP mẫu + danh mục SE |
| 1 — Kiến trúc & contract | 2–3 ngày | GĐ0 |
| 2 — Nhận diện | 1 ngày | Logo/màu/tên SE |
| 3 — Parser ERP | 3–5 ngày | GĐ1 |
| 4 — Mapping | 2–3 ngày | GĐ3 |
| 5 — S&OP/Forecast | 3–4 ngày | GĐ4 + tồn kho, leadtime |
| 6 — QA & bàn giao | 2–3 ngày | Tất cả |
| **Tổng** | **~2,5–4 tuần** | |

---

## 5. Input cần từ Sleep Expert (checklist)

- [ ] 1 file export ERP mẫu (đủ cột, ≥ 2–3 tháng)
- [ ] Danh mục: ngành / loại hình / class / brand / phân khúc giá / kênh / chất liệu
- [ ] Quy tắc gộp/loại/đổi tên brand & sản phẩm
- [ ] Tồn kho đầu kỳ + ngày cắt tồn
- [ ] Leadtime theo brand/nguồn cung + service level mục tiêu
- [ ] Phương pháp & hệ số forecast (nếu có chuẩn riêng)
- [ ] Bộ nhận diện: logo, màu, tên hiển thị, mật khẩu truy cập
- [ ] Danh sách người dùng & quyền (nếu cần)

---

## 6. Rủi ro & lưu ý

- **Dữ liệu build nhúng cứng (~1 MB).** Bản gốc nhúng thẳng data vào HTML; import chỉ áp trong phiên trình duyệt. SE cần quy trình rõ: ai build lại file "gốc" định kỳ, ở đâu lưu.
- **ERP khác cấu trúc = rủi ro lớn nhất.** Toàn bộ GĐ3 phụ thuộc chất lượng & tính nhất quán của file export SE. Cần chốt template export sớm.
- **Chất lượng dữ liệu nguồn.** Mã trùng, brand viết khác nhau, class thiếu mapping → cần bước làm sạch. Bản gốc đã có logic strip tiền tố số, gộp brand; SE cần bộ quy tắc tương đương.
- **Bảo trì lâu dài.** File 2.400 dòng HTML rất khó bảo trì thủ công. Cân nhắc tách phần data khỏi code để cập nhật hằng tháng dễ hơn.

### Gợi ý chiến lược (tùy chọn)
Thư mục lưu file này thuộc *"Power BI SE LTD / Data App"*. Nếu mục tiêu dài hạn là báo cáo bền vững nhiều người dùng, **Power BI** có thể là đích đến tốt hơn cho phần *phân tích/hiển thị* — trong khi vẫn dùng chung **data contract** ở đây làm nguồn chuẩn. Bản HTML phù hợp cho công cụ nội bộ nhẹ, offline, một file; Power BI phù hợp khi cần refresh tự động, phân quyền, và chia sẻ rộng. Không bắt buộc chọn ngay — data contract dùng được cho cả hai hướng.

---

## 7. Bước tiếp theo ngay

1. Điền file **"Sleep Expert — Data Contract & Import Template.xlsx"** (kèm theo) — đặc biệt các sheet danh mục & quy tắc.
2. Gửi lại 1 **file export ERP mẫu** để tôi viết lớp parser (GĐ3).
3. Cung cấp **logo + màu + tên hiển thị** để tôi dựng khung nhận diện SE (GĐ2).

Khi có 3 thứ trên, tôi có thể bắt đầu dựng bản HTML khung mang nhận diện Sleep Expert và lắp parser cho ERP của SE.
