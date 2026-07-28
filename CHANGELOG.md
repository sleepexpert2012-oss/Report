# Nhật ký phát hành Data App

Quy ước từ ngày 26/07/2026:

- Mỗi lần push bản phát hành lên nhánh `main` tăng một số `R`.
- Mỗi bản phải ghi ngày phát hành và những thay đổi người dùng có thể nhận biết.
- Thay đổi kỹ thuật nhỏ chưa phát hành không tạo số `R` mới.

## R60 — 28/07/2026

- Lấp toàn bộ dữ liệu đối soát cho đơn cũ: 1.825 đơn từ 01/2025 đến 03/2026 nay đã có phí sàn, tiền thực nhận, phương thức thanh toán và đơn vị vận chuyển. Độ phủ đạt 100% ở cả 19 tháng.
- Sửa lỗi làm sai lợi nhuận: khi kỳ đang xem không còn dữ liệu Ads, bảng trước đây coi chi phí Ads bằng 0 nên lợi nhuận bị thổi lên. Nay để trống và ghi rõ không tính được.
- Trường hợp kỳ chỉ có dữ liệu Ads một phần (Shopee Ads API chỉ lưu khoảng 6 tháng) thì cảnh báo rõ rằng lợi nhuận thật thấp hơn số hiển thị.

## R59 — 28/07/2026

- Hoàn nguyên bảng P&L về giao diện ban đầu theo yêu cầu: các thay đổi giao diện ở R56–R58 đã được gỡ bỏ.
- Giữ lại đúng một điều chỉnh: dòng Lợi nhuận vận hành khi bị lỗ thì phần trăm mang dấu âm và hiển thị màu đỏ như số tiền.
- Các sửa lỗi về SỐ LIỆU ở R55 (đơn escrow âm bị loại nhầm, các dòng bắc cầu giữa hai khối) vẫn được giữ nguyên.

## R58 — 28/07/2026

- Làm lại bảng P&L theo hệ thiết kế chuẩn: thang chữ rút từ 10 cỡ lẻ xuống còn 4 cỡ (12/14/16/24) nên các cấp bậc tách bạch rõ, không còn cảm giác chữ nào cũng gần giống nhau.
- Sửa lỗi tương phản: bốn màu chữ trước đây quá nhạt so với chuẩn tiếp cận (có màu chỉ đạt 2,3:1 trên mức tối thiểu 4,5:1) khiến phải căng mắt đọc; toàn bộ màu chữ nay đều đạt chuẩn.
- Gộp cột ghi chú xuống dòng thứ hai dưới tên chỉ tiêu, bảng còn 3 cột và thu hẹp từ toàn màn hình xuống 940px nên mắt đi quãng ngắn từ tên chỉ tiêu tới con số.
- Chuyển sang hệ biến CSS ba lớp, đổi giao diện về sau chỉ cần sửa một chỗ.
- Thêm làm nổi dòng khi rê chuột để dò ngang cho dễ; hỗ trợ màn hình hẹp.

## R57 — 28/07/2026

- Sửa lỗi CSS khiến các dòng khấu trừ trong bảng P&L không thụt lề (quy tắc chung có độ ưu tiên cao hơn đã đè mất phần thụt lề), nên bảng vẫn nhìn phẳng dù đã phân cấp cỡ chữ.
- Giới hạn bề ngang bảng và đặt tỷ lệ cột cố định, tránh việc trên màn hình rộng mắt phải đi quãng dài từ tên chỉ tiêu sang con số.
- Thêm gạch nối dẫn trước mỗi dòng khấu trừ để nhìn ra ngay đâu là mục con.

## R56 — 28/07/2026

- Thiết kế lại bảng P&L cho dễ đọc: phần trăm nay mang cùng dấu với số tiền (trước đây lợi nhuận âm nhưng % vẫn dương).
- Phân cấp rõ bằng cỡ chữ và nền: dải tiêu đề khối, dòng gốc, dòng trừ (thụt vào, chữ nhỏ xám), dòng thông tin, dòng kết quả, và dòng lợi nhuận cuối cùng nổi bật nhất — thay vì mọi dòng cùng cỡ như trước.
- Bỏ chữ "triệu" lặp trên từng dòng, đưa đơn vị lên tiêu đề cột; mọi số cố định một chữ số thập phân nên các cột thẳng hàng, dễ quét mắt.
- Giảm nhiễu màu: dòng trừ để xám thay vì tô đỏ toàn bộ; chỉ tô màu dòng kết quả cuối và các dòng kết quả bị âm.
- Ẩn cột ghi chú trên màn hình hẹp để bảng không bị tràn.

## R55 — 28/07/2026

- Sửa lỗi bảng P&L: đơn có tiền thực nhận âm (đơn đã hoàn tiền, Shopee trả về escrow âm vài nghìn đồng) bị loại nhầm khỏi khối đối soát, làm doanh thu sau huỷ và doanh thu nhóm đối soát lệch nhau không giải thích được. Tổng cộng 16 đơn / 15,2 triệu bị loại oan trong 4 tháng.
- Khối đối soát nay xác định theo "Shopee đã trả dữ liệu hay chưa" thay vì theo dấu của số tiền, nên hai khối luôn khớp và độ phủ đạt 100%.
- Thêm các dòng bắc cầu giữa hai khối: đơn chưa được đối soát, và đơn nghi đã hoàn tiền — mọi chênh lệch nay đều hiện rõ trên bảng thay vì để người đọc tự đoán.
- Phát hiện kèm theo: nhiều đơn đã giao xong nhưng tiền thực nhận ≤ 0 (tháng 6: 9 đơn/10,2tr; tháng 7: 3 đơn/2,6tr) — dấu hiệu hoàn tiền mà Returns API không ghi nhận.

## R54 — 28/07/2026

- Sửa lỗi khiến toàn bộ đơn từ 01/07/2026 không có phí sàn và tiền thực nhận: hàm đồng bộ `ops-sync` duyệt đơn cũ trước, hết giờ chạy thì dừng lặng nên đơn mới không bao giờ tới lượt.
- `ops-sync` nay xử lý đơn mới nhất trước, bỏ qua đơn đã đối soát xong, tự dừng khi hết ngân sách thời gian và ghi lại tiến độ để lượt sau làm tiếp.
- Thêm lịch chạy tự động cho `ops-sync` (8 lần/ngày, trước cron tồn kho và trước lượt dựng snapshot) — trước đây chỉ chạy khi có người bấm nút trong app.
- Màn Tài chính P&L: khi kỳ đang xem chưa có dữ liệu đối soát, hiển thị cảnh báo rõ ràng và để trống các dòng khối B thay vì hiện dãy số 0 kèm lợi nhuận âm gây hiểu nhầm là lỗ.

## R53 — 28/07/2026

- Vùng Vận hành Shopee: thêm bộ chọn khoảng thời gian tuỳ ý "Từ tháng → đến tháng" bên cạnh các nút nhanh 30/60/90/180 ngày; áp dụng cho Doanh thu & đơn hàng, Huỷ/trả, Tài chính P&L, Giao vận và Khách hàng khu vực.
- Chọn ngược tháng (tháng sau → tháng trước) tự đảo lại đúng thứ tự; nút ✕ để quay về kỳ theo ngày.
- Dòng trạng thái "Đang xem: ..." hiển thị rõ kỳ đang lọc và phạm vi tháng dữ liệu hiện có.
- Biểu đồ tự đổi mức gộp ngày/tuần/tháng theo độ dài khoảng tháng đã chọn.

## R52 — 28/07/2026

- Nâng cấp toàn diện Vùng Vận hành Shopee: thêm màn "Doanh thu & đơn hàng Shopee" riêng (xu hướng GMV/huỷ/đơn, phễu mốc vận hành, top SKU gắn ngành/brand/class/ABC), kỳ chọn 30/60/90/180/toàn bộ, tự gộp ngày→tuần→tháng.
- Màn Tài chính chuyển thành bảng phân tích P&L: GMV → huỷ → phí sàn → giảm trừ đối soát → tiền thực nhận → giá vốn → lãi gộp → Ads → lợi nhuận vận hành; tách khối đơn có đối soát escrow và ghi rõ độ phủ.
- Màn Huỷ/trả: cơ cấu lý do huỷ theo đơn + GMV, top SKU huỷ gắn class/phân khúc/vòng đời/ABC, biểu đồ xu hướng tỷ lệ huỷ.
- Màn Giao vận: thêm P50/P90 từng chặng, tỷ lệ huỷ theo đơn vị vận chuyển; ghi rõ thiếu dữ liệu ngày giao dự kiến nên chưa tính được % đúng cam kết.
- Màn Khu vực: thêm phân tích phương thức thanh toán × tỷ lệ huỷ (nhãn COD); ghi rõ Shopee đang mask tỉnh/thành.
- Tổng quan vận hành: thêm biểu đồ 90 ngày, top sản phẩm Ads theo chi phí và khối chất lượng dữ liệu.
- Phân tích vấn đề: thêm nhóm cảnh báo chéo "Ads × tồn kho" (SP chạy Ads hết/sắp hết tồn khả dụng).
- Màn Ads: thêm khối "Trực tiếp vs Tổng" cho chuyển đổi/SP bán/GMV; màn Từ khóa sửa bộ lọc vị trí chết thành lọc loại match và thêm cột hiệu quả sản phẩm gắn từ khóa.
- Livestream & Video: sửa lỗi tra sai entity nên bảng video hiển thị đủ số liệu từng video; thay biểu đồ thô bằng Chart.js chuẩn; Affiliate thêm % đóng góp doanh thu 30 ngày.
- Mọi chỉ số thiếu dữ liệu nguồn (trợ giá, voucher, ngày giao dự kiến, quận/huyện...) hiển thị "thiếu dữ liệu" thay vì số ước lượng.

## R51 — 26/07/2026

- Thêm kho dữ liệu API thô và checkpoint theo app/module/endpoint/scope để đồng bộ tăng dần, retry độc lập và không làm hỏng cả lượt chạy.
- Mở rộng Affiliate AMS từ 5 endpoint trang đầu lên 14 luồng: shop, sản phẩm, publisher, content Video/Live, campaign, conversion, validation và danh sách đề xuất.
- Mở rộng Shopee Video lên overview, trend, demographics và báo cáo chi tiết theo từng video/audience/sản phẩm; đồng bộ 14 video hiện có.
- Bổ sung Ads balance, shop toggle, recommended item và hourly performance; lưu rõ trạng thái GMS không áp dụng hoặc bị rate-limit.
- Bổ sung Product extra info, promotion, comment, violation, content diagnosis; Shop profile/warehouse; Payment escrow/income/wallet; Shipment và Logistics channel.
- Thiết kế lại báo cáo Affiliate và Video thành KPI, bảng xếp hạng, xu hướng và hiển thị chỉ số ATC thật từ Video API.
- Thêm bảng độ phủ luồng API và trạng thái rõ ràng cho Livestream/Brand Portal chưa đủ điều kiện kết nối.

## R50 — 26/07/2026

- Kết nối màn hình Affiliate với dữ liệu Shopee AMS API.
- Kết nối màn hình Livestream & Video với Shopee Video Analytics API.
- Hiển thị rõ giới hạn dữ liệu khu vực khi Shopee che địa chỉ khách hàng.
- Bổ sung mã bản GitHub, danh sách API, thời gian dữ liệu và thời gian đồng bộ trong Nhật ký cập nhật.
