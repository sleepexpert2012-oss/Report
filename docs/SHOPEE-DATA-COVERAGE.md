# Ma trận dữ liệu Shopee Open API

Cập nhật: 26/07/2026

## Nguyên tắc triển khai

- Chỉ đồng bộ API đọc phục vụ báo cáo; không tự gọi API thay đổi sản phẩm, giá, tồn kho, chiến dịch, đơn hàng hoặc nội dung.
- Mọi endpoint có phân trang phải đọc hết trang và lưu checkpoint.
- Một endpoint lỗi hoặc bị giới hạn tần suất không làm hỏng toàn bộ lượt đồng bộ.
- Dữ liệu thô chỉ được đọc bằng Supabase service role; trình duyệt đọc dữ liệu đã tổng hợp qua Edge Function.
- Báo cáo luôn hiển thị thời điểm dữ liệu Shopee mới nhất, thời điểm app tổng hợp và trạng thái độ phủ.

## Ma trận app, endpoint và màn hình

| App / module | API đọc cần đồng bộ | Dữ liệu báo cáo | Màn hình đích | Trạng thái 26/07 |
|---|---|---|---|---|
| Seller In House / Order | `get_order_list`, `get_order_detail`, `get_shipment_list`, `search_package_list`, `get_package_detail` | Đơn, dòng hàng, GMV, trạng thái, gói hàng, mốc vận hành | Tổng quan vận hành; Doanh thu & đơn hàng; Huỷ/trả; Giao vận; Khách hàng | Đơn/chi tiết đã đủ phân trang; shipment đã kết nối; package search/detail chưa triển khai |
| Seller In House / Product | `get_item_list`, `get_item_base_info`, `get_item_extra_info`, `get_model_list`, `get_item_promotion`, `get_comment`, `get_item_violation_info`, `get_item_content_diagnosis_result`, `get_item_list_by_content_diagnosis`, `get_shop_info`, `get_profile`, `get_warehouse_detail` | SKU/model, nội dung, giá/khuyến mãi, đánh giá, vi phạm, chất lượng nội dung, kho | Tồn kho; Hiệu quả sản phẩm; Chất lượng gian hàng | Đã lấy item/model/tồn/extra/promotion/comment/violation/diagnosis và shop/profile/warehouse |
| Payment | `get_escrow_list`, `get_escrow_detail_batch`, `get_payout_detail`, `get_payout_info`, `get_wallet_transaction_list`, `get_billing_transaction_info`, `get_income_overview`, `get_income_detail`, `get_income_statement`, `get_income_report` | Tiền thực nhận, phí, payout, ví, điều chỉnh, đối soát thu nhập | Tài chính & phí Shopee | Đã có escrow detail/list, income overview và wallet; payout_detail chỉ áp dụng shop cross-border; các income report/detail còn thiếu |
| Returns | `get_return_list`, `get_return_detail`, `get_reverse_tracking_info`, `query_proof` | Yêu cầu trả/hoàn, nguyên nhân, sản phẩm, số tiền, vận chuyển hoàn | Huỷ, trả hàng & hoàn tiền | List đã kết nối nhưng chưa có bản ghi; detail/tracking chưa lấy |
| Logistics | `get_tracking_info`, `get_tracking_number`, `get_channel_list`, `get_shipping_parameter` | Carrier, tracking, SLA chuẩn bị/giao, trạng thái vận chuyển | Hiệu suất giao vận | Tracking đã có; channel/parameter còn thiếu |
| Ads Service | `get_all_cpc_ads_daily_performance`, `get_all_cpc_ads_hourly_performance`, `get_product_campaign_daily_performance`, `get_product_campaign_hourly_performance`, `get_product_level_campaign_id_list`, `get_product_level_campaign_setting_info`, `get_recommended_keyword_list`, `get_recommended_item_list`, `get_total_balance`, `get_shop_toggle_info`, `get_gms_campaign_performance`, `get_gms_item_performance` | Spend, impression, click, CTR, GMV, ROAS, campaign/item/keyword, ngân sách | Ads Shopee; Từ khoá; Kế hoạch Ads | Daily/campaign/settings/1.424 keyword/hourly/balance/recommended item đã có; GMS item không áp dụng, GMS campaign đang rate-limit |
| Affiliate / AMS | `get_performance_data_update_time`, `get_shop_performance`, `get_product_performance`, `get_affiliate_performance`, `get_content_performance`, `get_campaign_key_metrics_performance`, `get_open_campaign_performance`, `get_targeted_campaign_performance`, `get_conversion_report`, `get_validation_list`, `get_validation_report`, `get_managed_affiliate_list`, `get_recommended_affiliate_list`, `query_affiliate_list`, `get_targeted_campaign_list`, `get_targeted_campaign_settings` | GMV, đơn, hoa hồng, publisher, content, campaign, conversion/validation | Affiliate | 14/14 luồng đang cấu hình đã đồng bộ; có phân trang |
| Shopee Video | `get_video_list`, `get_video_detail`, `get_overview_performance`, `get_metric_trend`, `get_user_demographics`, `get_video_performance_list`, `get_prodcut_performance_list`, `get_video_detail_performance`, `get_video_detail_metric_trend`, `get_video_detail_audience_distribution`, `get_video_detail_product_performance` | View, tương tác, ATC, đơn, GMV, audience, video và sản phẩm | Livestream & Video | 63/63 luồng theo 14 video đã đồng bộ; còn thiếu detail metric trend theo từng metric |
| Livestream Management | `get_session_detail`, `get_session_metric`, `get_session_item_metric`, `get_item_count`, `get_item_list`, `get_like_item_list`, `get_recent_item_list`, `get_show_item`, `get_item_set_list`, `get_item_set_item_list`, `get_latest_comment_list` | View, CCU, like, comment, share, ATC, đơn, GMV, hiệu suất sản phẩm theo phiên | Livestream & Video | OAuth cũ cần uỷ quyền lại; API yêu cầu `session_id`, không có endpoint liệt kê toàn bộ lịch sử Seller Centre |
| Brand Portal | `get_shop_sales_performance_detail`, `get_principal_sales_performance_detail`, `get_shop_affiliate_performance`, `get_principal_affiliate_performance`, `get_content_affiliate_performance`, `get_shop_livestream_performance`, `get_principal_livestream_performance`, `get_session_livestream_performance`, `get_shop_video_performance`, `get_principal_video_performance`, `get_clip_video_performance` | Báo cáo hợp nhất shop/principal về sale, Affiliate, Live và Video | Tổng quan; Affiliate; Livestream & Video | App đã tạo nhưng backend chưa có Partner Key/OAuth |

## Dữ liệu “Thêm vào giỏ hàng”

- Video Open API trả ATC ở báo cáo Video.
- Livestream Open API trả ATC trong `get_session_metric`.
- Seller Centre “Phân tích bán hàng → Hiệu quả sản phẩm” là dữ liệu analytics nội bộ. Catalog Open API phổ thông của Seller In House không có endpoint tương đương để đọc ATC toàn shop theo sản phẩm.
- Brand Portal có thể bổ sung báo cáo nội dung cấp shop/principal nếu tài khoản và app được Shopee cấp đúng phạm vi, nhưng phải kiểm tra trường phản hồi thực tế sau khi kết nối.
- App không được dùng click hoặc impression để ước tính ATC và gắn nhãn là dữ liệu thật.

## Điều kiện còn cần từ tài khoản Shopee

1. Thêm Supabase secret cho Brand Portal: Partner ID, Partner Key và hoàn tất OAuth đúng loại app.
2. Uỷ quyền lại Livestream Management để token có `user_id`.
3. Nếu Shopee không cấp endpoint analytics Seller Centre cho app hiện tại, ATC toàn shop chỉ có thể lấy từ API đặc quyền do Shopee cấp riêng; không dùng private web session trong hệ thống production.
