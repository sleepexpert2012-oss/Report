# Quy tắc doanh thu chuẩn

Áp dụng thống nhất cho mọi màn hình của Data App. VAT đầu ra mặc định: 8%.

## Nguồn duy nhất

- Dữ liệu gốc: Shopee API, bảng `sales_fact`.
- Không dùng file import thủ công, Kiot hay số nhập tay để tính doanh thu.
- Kiot chỉ được dùng làm nguồn đối chiếu kiểm thử.

## Công thức

```text
Doanh thu đối soát sau VAT
= GMV của đơn chưa huỷ
− Giảm giá do seller tài trợ
− Giá trị hàng hoàn trả thực tế

Doanh thu kế toán chưa VAT
= Doanh thu đối soát sau VAT ÷ 1,08
```

Trong đó:

- Đơn đang xử lý, chờ lấy hàng và đang giao được ghi nhận doanh thu.
- Đơn đã huỷ có doanh thu bằng 0.
- Giảm giá seller là trường cấp đơn, dù lặp trên nhiều dòng SKU vẫn chỉ tính một lần. Khoản này được phân bổ cho SKU theo tỷ trọng GMV.
- Chỉ trừ hoàn trả khi API có `so_luong_san_pham_duoc_hoan_tra > 0`.
- Trạng thái “đã chấp thuận yêu cầu trả” nhưng số lượng hoàn bằng 0 chưa làm giảm doanh thu.
- Mọi KPI mang tên `Doanh thu`, GP, GM% và P&L dùng doanh thu kế toán chưa VAT.
- Doanh thu sau VAT chỉ dùng cho đối soát Shopee/Kiot và được lưu riêng trong snapshot.
- Voucher/trợ giá do Shopee tài trợ không làm giảm doanh thu của seller.
- Phí sàn, Ads và escrow không làm giảm doanh thu; chúng thuộc phần lợi nhuận và đối soát dòng tiền.
- Bồi thường cho đơn đã huỷ là thu nhập khác, không phải doanh thu bán hàng.

## Ngày ghi nhận và điều chỉnh

- Kỳ doanh thu lấy theo ngày đặt hàng.
- Khi đơn bị huỷ hoặc hoàn trả về sau, hệ thống tính lại kỳ gốc của đơn.

## Quy tắc giá vốn thống nhất

```text
COGS = Số lượng bán thuần × Unit Cost (VND) chưa VAT
```

- `Unit Cost (VND)` chưa VAT là nguồn ưu tiên cho mọi màn hình và mọi cấp tổng hợp.
- Nếu SKU chỉ có `Giá vốn (+VAT)`, hệ thống tạm fallback bằng `Giá vốn (+VAT) ÷ 1,08`.
- Số lượng bán thuần bằng số lượng bán trừ số lượng hoàn trả thực tế; đơn đã huỷ có số lượng thuần bằng 0.
- Tổng quan, P&L, tồn kho, biểu đồ ngành và drill-down SKU/Class phải dùng cùng kết quả này.

## Đối chiếu chuẩn

Tệp Kiot tháng 08/2026 đã được dùng để xác nhận:

```text
GMV                         44.479.078
− Giảm giá seller            4.959.000
= Doanh thu đối soát sau VAT 39.520.078
÷ 1,08
= Doanh thu kế toán         36.592.665
```

Doanh thu đối soát khớp báo cáo Kiot sau thuế; doanh thu kế toán là cơ sở tính GP/P&L.

## Phân biệt chỉ số theo nguồn

- Ads, Affiliate, Livestream và Video có thể trả về “GMV quy gán”. Chỉ số này phục vụ đo hiệu quả kênh và không được gắn nhãn là doanh thu thuần.
- Mọi KPI mang tên “Doanh thu” trên app phải lấy từ kết quả chuẩn hoá của quy tắc trên.
