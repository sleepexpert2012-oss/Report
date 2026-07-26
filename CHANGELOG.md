# Nhật ký phát hành Data App

Quy ước từ ngày 26/07/2026:

- Mỗi lần push bản phát hành lên nhánh `main` tăng một số `R`.
- Mỗi bản phải ghi ngày phát hành và những thay đổi người dùng có thể nhận biết.
- Thay đổi kỹ thuật nhỏ chưa phát hành không tạo số `R` mới.

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
