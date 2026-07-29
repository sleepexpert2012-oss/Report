# Nhật ký phát hành Data App

Quy ước từ ngày 26/07/2026:

- Mỗi lần push bản phát hành lên nhánh `main` tăng một số `R`.
- Mỗi bản phải ghi ngày phát hành và những thay đổi người dùng có thể nhận biết.
- Thay đổi kỹ thuật nhỏ chưa phát hành không tạo số `R` mới.

## R71 — 29/07/2026

- Chuẩn hoá thẻ KPI trên toàn bộ 7 màn Vận hành Shopee theo đúng chuỗi P&L: GMV → Đã huỷ → Hoàn trả → Khuyến mãi → NMV (doanh thu thực). Mọi màn dùng chung một hàm tính nên không còn màn nào hiểu "doanh thu" theo kiểu riêng.
- Mỗi thẻ hiển thị kèm tỷ trọng trên GMV để thấy ngay khoản nào đang bào mòn doanh thu nhiều nhất.
- Các chỉ số riêng của từng màn (AOV, thời gian giao, phương thức thanh toán…) được giữ nguyên và xếp sau dải KPI chuẩn.
- Xoá bỏ phiên bản cũ của hàm dựng màn Vận hành đã bị thay thế nhưng vẫn nằm trong file, tránh sửa nhầm về sau.

## R70 — 29/07/2026

- Sửa mâu thuẫn số liệu giữa các màn: màn Tổng quan vận hành trước đây lấy doanh thu từ Edge Function, nơi chỉ trừ đơn có trạng thái "Đã huỷ", nên báo cao hơn bảng P&L mà không giải thích được. Nay cả hai màn dùng chung một hàm tính duy nhất.
- Màn Tổng quan hiển thị đủ chuỗi: GMV tổng → doanh thu sau huỷ và hoàn → doanh thu thuần → tiền thực nhận → lãi gộp → lợi nhuận vận hành, thay cho các chỉ số rời rạc trước đây.
- Đã đối chiếu: hai màn trên cùng kỳ 90 ngày cho ra số giống hệt nhau ở cả sáu chỉ tiêu.

## R69 — 29/07/2026

- Đồng bộ lại toàn bộ 2.111 đơn bằng connector mới. Tám cột trước đây trống nay đã đầy đủ cho cả 2.691 dòng: giá gốc, giá ưu đãi, voucher shop, trợ giá Shopee, phí vận chuyển người mua trả, hoàn xu, quận/huyện.
- Phí thanh toán hết bị cộng đôi: đơn mẫu từ 94.060 về đúng 47.030 như Shopee báo. Tổng tiền thực nhận không đổi (2.172.790.958đ) nên các con số lợi nhuận vẫn nhất quán.
- Bảng P&L tách "Voucher của shop" thành dòng riêng lấy từ cột thật của API, thay vì suy ngược từ chênh lệch đối soát như trước; phần dư còn lại đưa vào "Điều chỉnh đối soát khác".
- Hoàn trả nay ưu tiên trạng thái chính thức "Đã Chấp Thuận Yêu Cầu" từ Order API; đơn cũ Shopee không còn giữ trạng thái thì mới ước tính theo dòng tiền.
- Cập nhật lại mục dữ liệu còn thiếu trên màn Tài chính cho khớp thực tế: chỉ còn ngày giao dự kiến và quận/huyện (Shopee mask).

## R67 — 28/07/2026

- Phân loại đơn theo DÒNG TIỀN thay vì theo trạng thái đơn, sau khi đối chiếu với các mã đơn thật do chủ shop cung cấp. Shopee vẫn để trạng thái "Hoàn thành" cho đơn khách đã trả hàng, và để "Đã huỷ" cho đơn thất lạc mà Shopee đã đền bù — trạng thái đơn không phản ánh đúng thực tế.
- Đơn nhận được tiền tính là bán thành công (kể cả đơn Shopee đền bù hàng thất lạc); đơn đã rời kho mà không nhận được tiền tính là hoàn trả.
- Nhờ vậy hoàn trả năm 2025 từ 0 lên 171,5 triệu (81 đơn) và 2026 lên 69,8 triệu (54 đơn) — trước đây dòng này luôn bằng 0 vì Returns API không trả bản ghi nào.

## R66 — 28/07/2026

- Bảng P&L nay chỉ còn một dạng duy nhất: mỗi tháng một cột. Bỏ hẳn bảng tổng cả kỳ và nút chuyển qua lại.
- Bỏ in đậm các con số cho đỡ rối; phân cấp giữ bằng nền dòng và tên chỉ tiêu.
- Mỗi con số kèm thêm phần trăm bằng nhãn nhỏ in nghiêng bên cạnh: khối A tính trên GMV tổng, khối B tính trên doanh thu thuần.

## R65 — 28/07/2026

- Chọn một năm hoặc một khoảng nhiều tháng thì bảng P&L tự mở sẵn dạng theo tháng, không phải bấm chuyển nữa; chọn kỳ theo ngày vẫn xem tổng cả kỳ như cũ.
- Nhãn cột đổi thành T1, T2, T3… cho gọn; chỉ kèm năm khi kỳ bắc qua nhiều năm.

## R64 — 28/07/2026

- Sắp xếp lại bảng P&L theo đúng chuỗi kế toán: GMV tổng → trừ huỷ → trừ hoàn trả → trừ giảm giá và voucher → Doanh thu thuần, rồi mới tới khối phí sàn, giá vốn, quảng cáo và lợi nhuận.
- Khoản giảm giá và voucher trước đây nằm lẫn trong khối phí với tên "Giảm trừ đối soát khác", nay được đưa lên đúng vị trí trong phần doanh thu.
- Doanh thu thuần trở thành cơ sở tính phần trăm cho toàn bộ khối dưới, thay cho doanh thu chưa trừ voucher.

## R63 — 28/07/2026

- Màn Tài chính có thêm chế độ xem P&L theo tháng: mỗi tháng một cột, cột TỔNG ở cuối, kèm dòng số đơn, tỷ lệ huỷ và biên lợi nhuận để so sánh giữa các tháng.
- Thêm nút chọn nhanh "Năm 2025" và "Năm 2026" bên cạnh các nút 30/60/90 ngày.
- Phần tính toán P&L được tách thành một hàm dùng chung cho cả hai chế độ xem, đảm bảo hai bảng không bao giờ ra số khác nhau; đã đối chiếu tổng các tháng bằng đúng số tính một lần cho cả kỳ.

## R62 — 28/07/2026

- Đối chiếu chi phí Ads 2026 với báo cáo Seller Centre và ghi dòng điều chỉnh cho cả 6 tháng 01–06. Tổng chi phí Ads 2026 tăng từ 58,7 lên 94,7 triệu — con số cũ thiếu 61%.
- Riêng tháng 01/2026 chỉ có 7/31 ngày từ API (8,1 triệu) trong khi thực tế 32,3 triệu.
- Phần chênh được rải theo nguyên tắc có kiểm tra tính hợp lý: nếu mức chi suy ra cho ngày trống nằm trong khoảng 0,3–3 lần mức chi ngày đã có thì dồn vào ngày trống, ngược lại rải đều cả tháng để tránh tạo ra ngày tăng vọt giả.
- Phát hiện nguyên nhân lệch: bước đối soát tổng shop trong hàm đồng bộ Ads chưa từng chạy thành công (không có dòng "CPC khác" nào trong dữ liệu), nên bảng chỉ có chi phí cấp chiến dịch — vừa thiếu ngày vừa không khớp tổng thật.
- Dữ liệu gốc từ API được giữ nguyên; phần chênh ghi thành dòng riêng có nhãn rõ ràng để đối chiếu lại được.

## R61 — 28/07/2026

- Bổ sung chi phí Ads nhập tay cho 13 tháng Shopee API không còn lưu (01/2025–12/2025 và 03/2026), tổng 217,5 triệu. Nay cả 19 tháng đều có chi phí Ads nên bảng P&L tính được lợi nhuận cho toàn kỳ.
- Sửa cách kiểm tra dữ liệu Ads: đếm độ phủ theo từng ngày trong kỳ thay vì chỉ so ngày đầu và ngày cuối. Cách cũ bỏ sót trường hợp một tháng trống nằm lọt giữa vùng có dữ liệu, dẫn tới tính chi phí bằng 0 và thổi phồng lợi nhuận.
- Khi kỳ chỉ có dữ liệu Ads một phần, bảng nêu rõ phủ bao nhiêu trên tổng số ngày và cảnh báo lợi nhuận thật thấp hơn số hiển thị.

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
