▶ ĐÃ CHẠY: 28/07/2026 · kết quả: OK (12/12 hạng mục duyệt) · output tại: index.html (Vùng Vận hành Shopee) + knowledge/2026-07-28_audit-vung-van-hanh-shopee.md

# Nâng cấp Vùng Vận hành Shopee — khai thác tối đa dữ liệu API cho phân tích ra quyết định

> Ngày tạo: 2026-07-18 · Người giao: Louis · Target: Claude Code

## Bối cảnh dự án (đã biết trước — không cần hỏi lại)
- Dự án Sleep Expert Dashboard: 1 file index.html (~2.8MB) chạy hoàn toàn trong trình duyệt, không build step. Dữ liệu từ Supabase → Excel ảo trong bộ nhớ → engine Python (Pyodide) → render.
- Dữ liệu Shopee API đang đồng bộ về Supabase gồm:
  - `sales_fact` — đơn hàng chi tiết: trạng thái đơn, lý do hủy, trạng thái trả hàng/hoàn tiền, đơn vị vận chuyển, các mốc thời gian (đặt → xuất → giao dự kiến → giao thực tế → hoàn thành), giá gốc/giá ưu đãi, trợ giá seller vs Shopee, voucher, phí cố định/phí dịch vụ/phí thanh toán, số lượng hoàn trả, phương thức thanh toán, tỉnh/thành người mua...
  - `ads_fact` — hiệu suất Ads theo ngày: lượt xem, click, CTR, chuyển đổi (tổng + trực tiếp), chi phí, doanh số, ROAS/ACOS (tổng + trực tiếp), theo từng dịch vụ hiển thị/sản phẩm/vị trí.
  - `ads_keyword` — dữ liệu từ khóa Ads.
  - Các bảng dim: `sku` (giá vốn, ABC class, ngành hàng, brand, kích thước...), `dim_class` (phân khúc giá, vòng đời, vai trò SP, mùa vụ), `tonkho` (tồn hiện tại/khả dụng theo kho).
- Nguyên tắc bất di bất dịch của dự án: KHÔNG tự bịa dữ liệu — mọi số liệu hiển thị lấy trực tiếp từ Supabase tại thời điểm mở trang.
- Quy ước mặc định của dự án là sửa xong tự commit + push — NHƯNG với nhiệm vụ này, quy ước đó KHÔNG áp dụng (xem "Không được làm").

## Mục tiêu
Rà soát và nâng cấp TOÀN BỘ các màn hình trong Vùng Vận hành Shopee đã xây trong index.html, để khai thác hết chiều sâu của dữ liệu đang có — từ chỉ số, biểu đồ đến bảng chi tiết — sao cho người xem ra được quyết định vận hành (chứ không chỉ xem số). Trực quan hóa phải rõ ràng, dễ đọc kể cả khi xem khoảng thời gian dài.

## Cách làm — 3 giai đoạn, có điểm dừng duyệt giữa các giai đoạn

### Giai đoạn 1 — Audit (chưa sửa gì)
1. Liệt kê toàn bộ màn hình hiện có trong Vùng Vận hành Shopee: mỗi màn đang hiển thị chỉ số gì, biểu đồ gì, bảng gì.
2. Đối chiếu với các cột dữ liệu thực tế có trong `sales_fact`, `ads_fact`, `ads_keyword`, `tonkho`, `sku`, `dim_class` — chỉ ra: dữ liệu nào ĐANG CÓ mà CHƯA được khai thác trên màn hình nào.
3. Xuất báo cáo audit ngắn gọn: [màn hình] → [đang có gì] → [thiếu gì / có thể đào sâu thêm gì] → [đề xuất cụ thể].
→ DỪNG LẠI, trình bày báo cáo + danh sách đề xuất được đánh số ưu tiên, chờ tôi chọn/duyệt hạng mục nào làm trước.

### Giai đoạn 2 — Thực thi (sau khi tôi duyệt danh sách)
Với từng hạng mục được duyệt, gợi ý hướng đào sâu (điều chỉnh theo kết quả audit thực tế):
- **Vận hành đơn hàng**: phễu trạng thái đơn (đặt → xuất → giao → hoàn thành), tỷ lệ hủy theo lý do, tỷ lệ trả hàng/hoàn tiền theo SKU, thời gian xử lý từng chặng (đặt→xuất, xuất→giao) so với cam kết, hiệu suất theo đơn vị vận chuyển.
- **Tài chính đơn hàng**: cơ cấu phí (phí cố định/dịch vụ/thanh toán) trên doanh thu, trợ giá seller vs Shopee, tỷ trọng voucher, net revenue thực sau phí và hoàn trả.
- **Khách hàng/địa lý**: phân bố đơn theo tỉnh/thành, tỷ lệ hủy-hoàn theo khu vực, phương thức thanh toán.
- **Ads**: đào sâu keyword (ads_keyword đang có dữ liệu nhưng cần kiểm tra đã dùng chưa), so sánh chuyển đổi trực tiếp vs tổng, CTR theo vị trí hiển thị.
- **Liên kết chéo**: gắn tồn kho + ABC class + vòng đời SP vào các bảng phân tích để cảnh báo (vd: SP đang chạy Ads nhưng sắp hết tồn; SP tỷ lệ hoàn cao thuộc class nào).
- Mọi biểu đồ mới/sửa lại phải theo chuẩn đã thống nhất trong dự án: màu cố định cho mỗi chỉ số, nhãn số chỉ hiện ở điểm quan trọng, trục thời gian không chồng chữ, tự gộp nhóm ngày→tuần→tháng khi khoảng thời gian dài.
- Checkpoint: sau mỗi màn hình sửa xong, xuất ✅ [tên màn] — đã đổi gì.

### Giai đoạn 3 — Nghiệm thu local
- Khởi động local preview: `python3 -m http.server 8420` trong thư mục dự án, báo địa chỉ http://localhost:8420 để tôi mở xem.
- DỪNG LẠI chờ tôi duyệt. CHỈ commit + push sau khi tôi xác nhận. Nếu tôi yêu cầu sửa, quay lại Giai đoạn 2.

## Không được làm
- Không tự bịa/ước lượng số liệu — chỉ tính toán từ dữ liệu thật trong Supabase. Chỉ số nào không đủ dữ liệu để tính đúng thì ghi rõ "thiếu dữ liệu X" thay vì hiển thị số gần đúng.
- Không đổi công thức các chỉ số đã thống nhất trước đó (DT thực (net), ROAS thực...) — chỉ thêm mới hoặc trình bày lại.
- Không sửa Edge Functions, không đổi schema Supabase, không đụng cron — phạm vi chỉ là hiển thị/phân tích trong index.html. Nếu phát hiện muốn phân tích sâu hơn mà API/bảng hiện tại chưa đồng bộ trường cần thiết → ghi vào mục "Đề xuất mở rộng dữ liệu" trong báo cáo audit, KHÔNG tự ý sửa connector.
- Không thêm thư viện/dependency ngoài, không thêm build step.
- Không sửa các vùng khác ngoài Vùng Vận hành Shopee.
- KHÔNG commit/push trước khi tôi duyệt ở Giai đoạn 3.

## Hoàn thành khi
- Báo cáo audit đã được duyệt, các hạng mục duyệt đã làm xong.
- Các màn hình Vùng Vận hành Shopee hiển thị đủ chiều sâu dữ liệu đã chọn, biểu đồ rõ ràng kể cả khi xem thời gian dài, số liệu khớp dữ liệu thật.
- Đã chạy local cho tôi xem, tôi duyệt, rồi mới commit + push.
