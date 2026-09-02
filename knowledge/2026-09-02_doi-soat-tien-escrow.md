# Đối soát tiền: `ops-sync` bỏ 68/86 trường Shopee trả về

Ngày 2/9/2026 · so với báo cáo Power BI của một bên khác mà anh Louis đưa xem

## Đo được phần thiếu, không phải cảm nhận

Dùng tiền ký quỹ Shopee làm **vòng khoá**: nếu mô hình phí của mình đúng thì
*khách trả − các khoản phí* phải bằng *tiền Shopee thực trả*.

| | |
|---|---|
| Khách thanh toán (1.518 đơn không huỷ) | 1.736,9 tr |
| (−) 3 khoản phí `ops-sync` đang lưu | −346,6 tr |
| = mô hình của mình tính ra | **1.390,3 tr** |
| **Tiền ký quỹ Shopee THỰC TRẢ** | **1.543,9 tr** |
| **Độ lệch** | **+153,6 tr = 8,8%** |

Lệch theo hướng **Shopee trả nhiều hơn** mô hình. Nghĩa là phần thiếu chủ yếu
là các khoản Shopee **bù cho shop**: hỗ trợ freeship, hoàn phí vận chuyển, đồng
tài trợ voucher. Đúng như cách bên kia gom "Phí sàn" thành một rổ NET có cả
khoản trừ và khoản bù.

**8,8% này là thước đo độ hoàn chỉnh của bảng lãi lỗ.** Lưu đủ trường thì nó
phải tiến về 0. Không về 0 thì biết ngay còn thiếu.

## Nguyên nhân: tách cột cứng

`payment.get_escrow_detail` trả **86 trường** trong `order_income` (số trường
thay đổi theo đơn; có đơn tới 111). `ops-sync` đọc **18**, bỏ **68**.

Trong nhóm bị bỏ có đúng những khoản làm lệch:

`order_ams_commission_fee` · `shopee_shipping_rebate` ·
`shipping_fee_discount_from_3pl` · `seller_order_processing_fee` ·
`shipping_seller_protection_fee_amount` · `ads_escrow_top_up_fee_or_technical_support_fee` ·
`seller_return_refund` · `drc_adjustable_refund` · `reverse_shipping_fee` ·
`buyer_transaction_fee` · `payment_promotion` · `seller_coin_cash_back` ·
`voucher_from_external_party` · `final_shipping_fee` · `actual_shipping_fee`

Còn có hai trường đáng chú ý: **`cost_of_goods_sold`** và
`original_cost_of_goods_sold` — Shopee cũng trả giá vốn. Chưa kiểm xem có giá
trị thật hay chỉ dùng cho hàng ký gửi.

## Cách làm khác đi

Không tách cột cứng nữa. `v2_fact_escrow` lưu **nguyên văn `order_income` vào
cột jsonb**, cộng 3 cột tách riêng cho trường dùng nhiều nhất. Khung nhìn
`v2_escrow_pl` bóc 30 khoản của bảng lãi lỗ ra từ jsonb.

**Cần thêm khoản phí → sửa khung nhìn, KHÔNG phải kéo lại.** Đây là điểm khác
căn bản với `ops-sync`: nó tách cột nên mỗi lần thiếu trường là phải sửa bảng
rồi kéo lại toàn bộ, mà kéo lại thì tốn 2.211 lời gọi API.

## `get_escrow_detail_batch` không dùng được

Tài liệu ghi `order_sn_list` kiểu `string[]`, nhận 1–50 đơn. Đã thử **cả ba
khuôn** mã hoá trên query string:

| Khuôn | Kết quả |
|---|---|
| JSON `order_sn_list=["a","b"]` | `error_param` |
| Lặp khoá `order_sn_list=a&order_sn_list=b` | `error_param` |
| Nối phẩy `order_sn_list=a,b` | `error_param` |

Kết luận: endpoint này **không mở cho App Category "Seller In House System"** —
Shopee trả `error_param` chứ không trả lỗi quyền, nên nhìn vào rất dễ tưởng là
lỗi tham số. `get_escrow_detail` (từng đơn) thì chạy tốt.

Hệ quả: backfill 2.211 đơn phải gọi 2.211 lần, khoảng 260 đơn mỗi 100 giây →
~15 phút. Hàm `escrow-sync` bỏ qua đơn đã có nên chạy lại được nhiều lần, và
sau lần đầu thì chỉ kéo đơn mới.

## Chốt của anh Louis cho màn P&L

- Xương sống bảy bước như bên kia: Doanh thu → Giá vốn → Phí sàn → Phí quảng
  cáo → Phí khác → Điều chỉnh → Lợi nhuận
- Cắt theo **Brand**, **Ngành hàng**, và thêm **Nhóm / Sản phẩm** (nhóm là
  `subcategory_name` như *Hybrid*, *Power X Core*; sản phẩm là SKU theo size)
- Không cắt theo Sàn/Shop — mình một sàn một shop; cột `channel` đã có sẵn nên
  khi thêm Đại Lý là tự tách
- **GM giữ nguyên cách tính hiện tại**, không đổi sang định nghĩa của bên kia

## Chỗ đáng ngờ trong báo cáo bên kia, đã báo anh Louis

Doanh thu của họ 4,03bn bằng đúng tổng 7 dòng con — trong đó có **cả** *Giá gốc
đơn hàng* 3,63bn **và** *Giá trị trước giảm giá* 2,35bn, hai khoản chồng lên
nhau, rồi trừ *Giảm giá người bán* −2,50bn. Ra biên lợi nhuận **43,09%**, rất
cao cho thương mại điện tử. Nếu lấy 43% của họ làm mốc so với 33,4% của mình
thì phải hỏi định nghĩa Doanh thu của họ trước — hai mẫu số khác nhau.
