# data-goc — file GỐC từ nguồn ngoài · CHỈ ĐỌC

Không sửa file trong thư mục này. Muốn đổi số liệu thì up bản mới, không đè lên bản cũ.

## upload-erp/

| File | Vai trò |
|---|---|
| `Master Data.xlsx` | **Bản gốc** Louis gửi ngày 30/08/2026. Không đụng tới. 4 sheet: `0. Mã Supplier` (tiêu đề dòng 5) · `1. Master Data` (dòng 7, 143 SKU) · `4. Purchasing` (dòng 1, 21 PO / 182 dòng) · `Mã Kho` (dòng 1, 4 kho). |
| `Master Data (them cot Brand).xlsx` | **Bản dùng để nạp.** Giống hệt bản gốc, chỉ thêm cột `AG` = "Brand (thương hiệu)" ở sheet `1. Master Data`. |
| `Sleep Expert — Data Model (Star Schema).xlsx` | Master **đời trước** (14/07/2026). Giữ để đối chiếu, không nạp nữa. |
| `Sleep Expert — Ads Import.xlsx` | Nguồn sheet `Ads_Fact` cho app cũ. |

### Cột Brand được thêm thế nào

Luật do Louis chốt ngày 30/08/2026:

> Nhà cung cấp **POWER X (SUCN0001)** làm hàng brand **POWER X**;
> mọi nhà cung cấp còn lại làm hàng brand **TUFT & NEEDLE**.

Đã đối chiếu ngược với master đời trước: **khớp 146/146 SKU, không một ngoại lệ**.
Luật này được khai trong `v2/contracts/sku-master.yaml` (luật `anh_xa_khai_bao`) nên mỗi
lần nạp đều được kiểm tra lại. Khi công ty có brand thứ ba, sửa bảng ánh xạ ở đó.

Cột được chèn bằng cách sửa thẳng XML và **nối vào cuối vùng dữ liệu (cột AG)**, không dịch
cột nào. Đã nghiệm thu: 30/30 thành phần của file còn nguyên, **164 công thức sheet Master
Data và 757 công thức sheet Purchasing còn đủ**, 4 vùng kiểm tra dữ liệu (dropdown) còn nguyên.
Chỉ duy nhất `xl/worksheets/sheet2.xml` thay đổi.

## mau-bieu/

`MAU-BO-SUNG-CHI-PHI-ADS.xlsx` — biểu mẫu điền tay bù chi phí Ads các tháng Shopee API
không còn lưu (2025 + 03/2026).

## Những điểm cần biết về bộ dữ liệu hiện tại (đo ngày 30/08/2026)

**Đã tốt hơn bản cũ:**
- Hết lệch ánh xạ nhà cung cấp. Bản cũ có 53 dòng mà `SUVN0001` ứng với cả *HUY HOÀNG NAM*
  lẫn *AP WOOD*; bản mới sạch.
- Có thêm sheet `4. Purchasing` — 21 PO, 2.337.320.899đ mua hàng năm 2025. Dữ liệu này trước
  đây hoàn toàn không có.
- Sheet `Mã Kho` phân loại rõ: **WH04 là "Kho hàng lỗi", loại "Kho lưu trữ"** — trong khi
  bảng `dim_kho` đang chạy ghi cả 4 kho đều là kho bán hàng, tồn khả dụng "Có".

**Còn thiếu:**
- `Leadtime`: 1/143 SKU. Sheet `0. Mã Supplier` cũng chỉ HAPPYTOWN có giá trị `"15-20"`
  (ghi dạng chuỗi, không phải số).
- Giá vốn: 83/143 SKU. Đã kiểm chứng — 60 SKU thiếu giá vốn đều **chưa từng có đơn mua và
  chưa bán được đồng nào**, nên là phản ánh đúng thực tế chứ không phải lỗi dữ liệu.
- Không còn cột **Chất liệu** (bản cũ có, dùng cho phân tích ngành Chăn ga).
- 17 mã đang bán trên Shopee chưa có trong master — xem
  `v2/output/2026-08-30_bo-sung-master-sku.xlsx`.

**Lỗi trong sheet `4. Purchasing` cần sửa ở nguồn:**
- `Leadtime` (cột O) chứa số serial ngày Excel (45879 = 10/08/2025) thay vì số ngày, do công
  thức lấy *Date Receive − Date Request* mà `Date Request` chỉ có 29/182 dòng.
- `Paid Amount` (AB) có 76/182 dòng ghi `False` thay vì số tiền.
- `Supplier code` (D) trống 26/182 dòng.
- `Payment status` (Z) trống 102/182 dòng — không phân biệt được "chưa trả" với "chưa điền".
