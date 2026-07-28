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

---

## 2026-07-28 · CSS không ăn vì độ ưu tiên — và cách kiểm chứng giao diện thay vì đoán

**Sai gì:** Đặt `.pl-ded th{padding-left:34px}` để thụt lề dòng khấu trừ, nhưng quy tắc chung `.pl tbody th{padding:7px 12px}` có độ ưu tiên CAO HƠN (0,1,2 so với 0,1,1) nên `padding` viết tắt đè mất `padding-left`. Kết quả: bảng vẫn phẳng, người dùng phản hồi "mục mẹ với mục con to bằng nhau" dù cỡ chữ đã phân cấp đúng. Tôi đã báo "đã sửa xong" mà chưa thực sự nhìn thấy trang render.

**Sửa gì:** đổi sang `.pl tbody tr.pl-ded th` (0,2,3) để thắng quy tắc chung. Sau đó **kiểm chứng bằng Chrome headless** thay vì đoán:
- `--dump-dom` cùng một đoạn script đọc `getComputedStyle` → in ra padding/cỡ chữ/màu THẬT của từng dòng.
- `--screenshot` → tự mở ảnh bằng công cụ Read để nhìn tận mắt.
Chrome có sẵn tại `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

**Rule rút ra:**
1. Khi ghi đè một thuộc tính con (`padding-left`, `margin-top`, `border-color`), phải kiểm tra quy tắc gốc có dùng dạng viết tắt (`padding`, `margin`, `border`) với độ ưu tiên cao hơn không. Viết tắt luôn reset toàn bộ các thuộc tính con.
2. Không bao giờ báo "đã sửa giao diện" nếu chỉ mới kiểm tra cú pháp. Cú pháp đúng không có nghĩa là CSS được áp dụng. Phải render thật rồi đo `getComputedStyle` và xem ảnh chụp.
3. Cách dựng bàn thử: trích hàm render ra một file HTML độc lập, nạp dữ liệu thật từ file JSON, rồi cho Chrome headless đo và chụp. Nhanh hơn nhiều so với nhờ người dùng chụp màn hình rồi mô tả lại.
4. **Bẫy này lặp lại lần hai** (28/07, khi làm lại bảng theo skill): `.pl tr.pl-final td{color:...}` (0,2,2) đè mất `.pl .is-neg{color:...}` (0,2,0) nên số lợi nhuận âm hiện màu navy thay vì đỏ. Quy tắc rút ra: khi một dòng có màu nền/màu chữ theo "loại dòng", thì lớp tô màu theo "ngữ nghĩa" (âm/dương) PHẢI có độ ưu tiên cao hơn — viết `.pl tbody tr td.is-neg` (0,2,3). Đo lại bằng `getComputedStyle` sau mỗi lần sửa, đừng tin mắt đọc code.

---

## 2026-07-28 · Quá nhiều cỡ chữ gần bằng nhau = không có phân cấp

**Sai gì:** Khi làm bảng P&L tôi tự chọn cỡ chữ theo cảm tính: 11 · 11,5 · 12 · 12,5 · 13 · 13,5 · 14 · 15 · 15,5 · 19px — mười cỡ, nhiều cỡ chỉ cách nhau 0,5px. Mắt không phân biệt nổi 12 với 12,5 nên dù "có phân cấp" trên lý thuyết, nhìn vào vẫn thấy phẳng và rối. Người dùng phản hồi hai lần mới lộ ra.

**Phát hiện nhờ:** skill `ui-ux-pro-max`, mục Typography: *"Use consistent modular scale — Type scale (12 14 16 18 24 32). Don't: Arbitrary sizes."* Và kiểm tra tương phản cho thấy 4/6 màu chữ dưới chuẩn WCAG AA (có màu chỉ 2,26:1).

**Sửa gì:** rút về đúng 4 cỡ 12/14/16/24; để độ đậm (400/600/700/800) và màu gánh phần phân cấp còn lại; mọi màu chữ ≥ 4,5:1; gộp cột ghi chú xuống dòng 2 để bảng còn 3 cột và hẹp lại còn 940px.

**Rule rút ra:**
1. Đừng tự chọn cỡ chữ theo cảm tính. Dùng thang modular (12/14/16/18/24/32) và chỉ lấy 3-4 bậc cho một thành phần. Hai cỡ cách nhau dưới 2px thì mắt coi như bằng nhau — tốn cỡ mà không được gì.
2. Phân cấp nên do nhiều thuộc tính cùng gánh: cỡ chữ + độ đậm + màu + nền + thụt lề. Chỉ dựa vào cỡ chữ thì phải chênh rất nhiều mới thấy.
3. Chữ xám nhạt trên nền trắng là nguyên nhân "rối mắt" hay bị bỏ sót. Luôn tính tỷ lệ tương phản trước khi chọn màu chữ phụ — công thức WCAG chỉ vài dòng Python.
4. Bảng càng rộng thì mắt càng phải đi xa giữa nhãn và số. Giới hạn bề ngang và giảm số cột hiệu quả hơn nhiều so với chỉnh màu.

---

## 2026-07-28 · Làm quá phạm vi được giao — 3 vòng thiết kế lại cho một yêu cầu nhỏ

**Sai gì:** Người dùng nêu ba điểm cụ thể về bảng P&L (phần trăm mất dấu · mục mẹ và mục con cùng cỡ chữ · nhìn rối). Thay vì sửa đúng ba điểm đó, tôi thiết kế lại toàn bộ bảng ba lần liên tiếp (R56 → R57 → R58): đổi cấu trúc cột, đổi thang chữ, đổi bảng màu, dựng hệ token ba lớp, thu hẹp bề ngang. Kết quả: người dùng phản ứng "nhìn xấu bỏ mẹ" và yêu cầu trả về bản gốc. Toàn bộ công R56–R58 bị bỏ, chỉ giữ lại một dòng sửa màu.

**Sửa gì:** `git show <commit>:file` để lấy lại nguyên khối code cũ, ghép về, rồi thêm ĐÚNG một thay đổi được yêu cầu. Kiểm chứng bằng diff — chỉ còn 3 dòng khác bản gốc.

**Rule rút ra:**
1. Người dùng nêu N điểm cụ thể thì sửa đúng N điểm đó. Đừng suy ra "chắc họ muốn đẹp hơn" rồi làm lại từ đầu — thẩm mỹ là chuyện của chủ sở hữu sản phẩm, không phải của mình.
2. Skill thiết kế đưa ra chuẩn mực chung (thang chữ, tương phản), nhưng chuẩn mực KHÔNG thay được ý thích của người dùng. Dùng skill để sửa lỗi khách quan (tương phản dưới chuẩn), đừng dùng để biện minh cho việc đổi phong cách khi không được yêu cầu.
3. Thay đổi giao diện lớn thì hỏi trước, hoặc làm một bản nháp cho xem rồi mới áp dụng. Sửa số liệu sai thì cứ làm — sai là sai. Nhưng "đẹp" thì phải để người dùng quyết.
4. Khi phải hoàn nguyên: lấy code từ commit cũ chứ đừng gõ lại từ trí nhớ, rồi diff để chứng minh chỉ còn đúng phần được yêu cầu.

---

## 2026-07-28 · Số API khớp "có vẻ hợp lý" nhưng lệch báo cáo gốc

**Sai gì:** Tôi báo tổng chi phí Ads 2026 là 58,7 triệu dựa trên `ads_fact`, kèm cảnh báo thiếu ngày. Người dùng mở Seller Centre đối chiếu thì thấy sai — thực tế 70,5 triệu. Lệch 11,8 triệu (20%).

**Nguyên nhân:** hàm đồng bộ Ads có hai phần — lấy chi phí theo từng chiến dịch, và một bước "đối soát" gọi API tổng shop rồi ghi phần chênh. Bước đối soát **chưa từng chạy thành công**: trong toàn bộ dữ liệu không có một dòng "CPC khác (chưa phân bổ SP)" nào. Nên bảng chỉ có chi phí cấp chiến dịch, thiếu phần CPC cấp shop và các chiến dịch đã xoá.

Đáng chú ý: tháng 5 dữ liệu API lại **CAO HƠN** báo cáo gốc dù thiếu 2 ngày — nghĩa là lệch cả hai chiều, không thể sửa bằng cách "cộng thêm phần thiếu ngày".

**Rule rút ra:**
1. Đếm độ phủ (bao nhiêu ngày có dữ liệu) chỉ phát hiện được thiếu, KHÔNG phát hiện được sai. Một tháng đủ 30/30 ngày vẫn có thể lệch tổng.
2. Khi hệ thống có sẵn một bước đối soát với nguồn tổng, phải kiểm tra bước đó có thật sự chạy không — đếm số bản ghi nó tạo ra. Code có logic đúng không đảm bảo logic đó được thực thi.
3. Với số liệu tài chính, luôn đối chiếu ít nhất một kỳ với báo cáo gốc của nhà cung cấp trước khi công bố. Tôi đã bỏ qua bước này và đưa ra con số sai.
4. Khi sửa lệch: giữ nguyên dữ liệu gốc, ghi phần chênh thành bản ghi riêng có nhãn. Đừng sửa đè lên số gốc — mất khả năng truy vết.
