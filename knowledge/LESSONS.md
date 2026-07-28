# Bài học tích lũy — Data App

Mỗi entry: ngày · việc · sai gì · sửa gì · rule rút ra.

---

## 2026-07-28 · Thêm bộ chọn "từ tháng → đến tháng" cho Vùng Vận hành Shopee

**Sai gì:** Dùng find-and-replace hàng loạt `_ops2Win(SF,S.opsDays)` → `_ops2Wsel(SF)` trên toàn file. Phép thay thế đụng luôn dòng nằm BÊN TRONG thân hàm `_ops2Wsel` (dòng fallback về chế độ ngày) → hàm tự gọi chính nó → đệ quy vô hạn. `node --check` vẫn PASS vì cú pháp hoàn toàn hợp lệ; lỗi chỉ lộ ra khi chạy thật, và hậu quả là treo trình duyệt ở MỌI màn vận hành.

**Sửa gì:** Trả dòng fallback bên trong `_ops2Wsel` về `_ops2Win(SF,S.opsDays)`; viết test node với dữ liệu giả lập 9 tháng để chạy thật các hàm chọn kỳ.

**Rule rút ra:**
1. Đếm số lần thay thế và ĐỐI CHIẾU với số call site đã grep trước đó — lệch 1 là dấu hiệu đụng nhầm chỗ (ở đây grep ra 5, replace báo 6).
2. Khi hàm mới có fallback gọi hàm cũ, luôn kiểm tra phép thay thế có đụng thân hàm mới không.
3. `node --check` chỉ bắt lỗi cú pháp, KHÔNG bắt lỗi logic/đệ quy. Với logic tính toán (chọn kỳ, gộp nhóm, công thức) phải trích hàm ra chạy thử bằng node với dữ liệu giả lập — gồm cả ca biên: khoảng đảo ngược, 1 phần tử, rỗng, giá trị không tồn tại.

---

## 2026-07-28 · Truy nguyên vì sao P&L tháng 7 trống phí và tiền thực nhận

**Sai gì (trong hệ thống, không phải người làm):** `ops-sync` làm giàu đơn theo thứ tự `_id` tăng dần — đơn CŨ trước. Vòng này gọi 2 API Shopee + 1 UPDATE cho MỖI đơn, không có chặn thời gian và không có checkpoint. Edge Function hết giờ chạy thì chết lặng, không báo lỗi ở đâu; lần chạy sau lại bắt đầu từ đơn cũ nhất và gọi lại API cho đơn đã có dữ liệu. Kết quả: vòng lặp chết đói — đơn mới nhất vĩnh viễn không tới lượt, và hệ thống KHÔNG BAO GIỜ tự phục hồi. Thêm vào đó `ops-sync` không có cron, chỉ chạy khi bấm nút.

**Cách phát hiện:** đếm độ phủ từng cột theo THÁNG thay vì tổng thể. Tổng thể chỉ thấy "250/2690 dòng có phí" — vô nghĩa. Tách theo tháng mới lộ mốc gãy sắc lẹm: 100% có escrow đến 26/06, 0% từ 01/07. Gãy đột ngột = lỗi tiến trình; giảm dần đều = bản chất dữ liệu (vd tiền chưa được Shopee giải ngân). Phân biệt được hai dạng này là mấu chốt.

**Sửa gì:** đảo thứ tự (mới nhất trước), bỏ qua đơn đã có `tien_ky_quy`, thêm `budget_ms` + checkpoint `order_enrichment/escrow_tracking`, thêm cron 8 lần/ngày. Phía hiển thị: bảng P&L cảnh báo rõ khi khối đối soát rỗng thay vì hiện số 0 và lợi nhuận âm.

**Rule rút ra:**
1. Vòng lặp gọi API theo từng bản ghi trong Edge Function PHẢI có đủ 3 thứ: chặn thời gian, checkpoint tiến độ, và bỏ qua bản ghi đã xử lý. Thiếu một trong ba là sớm muộn cũng chết đói. `smooth-responder` cùng dự án đã làm đúng cả 3 — dùng nó làm khuôn mẫu.
2. Luôn xử lý bản ghi MỚI NHẤT trước. Dữ liệu gần đây là thứ cần cho quyết định; nếu phải bỏ dở thì bỏ phần cũ.
3. Khi một chỉ số trống bất thường, đừng đoán — đếm độ phủ theo thời gian để tìm mốc gãy. Mốc gãy nằm ở đâu sẽ chỉ thẳng ra nguyên nhân.
4. Job nền quan trọng phải có cron riêng, không phụ thuộc thao tác tay của người dùng.

---

## 2026-07-28 · Dùng `> 0` để kiểm tra "đã có dữ liệu" — sai ở ca số âm

**Sai gì:** Bảng P&L xác định khối đối soát bằng `(phí>0 || escrow>0)`. Ý định là "đơn nào đã được Shopee đối soát", nhưng phép so sánh này ngầm giả định tiền luôn dương. Thực tế đơn đã hoàn tiền có escrow ÂM (−1.620đ hoặc −2.700đ) → bị loại khỏi khối đối soát dù dữ liệu ĐÃ CÓ. Hậu quả: doanh thu sau huỷ và doanh thu nhóm đối soát lệch nhau mà không dòng nào giải thích. 16 đơn / 15,2 triệu bị loại oan trong 4 tháng.

**Người dùng phát hiện trước:** anh Louis thấy hai con số không khớp và đoán nguyên nhân là thiếu dữ liệu hoàn trả. Đoán sai nguyên nhân nhưng chỉ đúng chỗ hỏng — bài học là khi người dùng nói "hai số này không khớp" thì phải đi kiểm chứng bằng số chứ đừng vội xác nhận hay bác bỏ giả thuyết của họ.

**Sửa gì:** phân biệt ô TRỐNG (chưa đối soát) với giá trị 0/âm (đã đối soát) bằng cờ `hasRec` đọc từ chuỗi gốc trước khi ép kiểu số. Thêm các dòng bắc cầu giữa hai khối để mọi chênh lệch tự hiện ra trên bảng.

**Rule rút ra:**
1. Kiểm tra "đã có dữ liệu chưa" phải hỏi ô có TRỐNG không, tuyệt đối không dùng `> 0`. Số 0 và số âm đều là dữ liệu hợp lệ. Ép kiểu số làm mất thông tin này nên phải giữ cờ ngay lúc đọc.
2. Khi bảng có hai khối mà tổng của chúng phải liên hệ với nhau, LUÔN có dòng bắc cầu hiển thị phần chênh. Nếu người đọc phải tự trừ hai số để phát hiện bất thường thì thiết kế bảng đã sai.
3. Tiền âm là chuyện bình thường trong đối soát sàn (hoàn tiền, điều chỉnh, phạt). Đừng giả định dòng tiền một chiều.
