# Audit Vùng Vận hành Shopee — Giai đoạn 1 (chưa sửa gì)

> Ngày: 2026-07-28 · Thực hiện: Claude Code · Prompt gốc: `prompt/done/2026-07-18-nang-cap-vung-van-hanh-shopee.md`
> Trạng thái: CHỜ DUYỆT danh sách đề xuất trước khi sang Giai đoạn 2.

## 1. Kiến trúc hiện tại của vùng

Vùng "Vận hành Shopee" trong sidebar gồm 11 mục, chia 2 loại:

- **8 màn `shop*`** (Tổng quan vận hành, Tài chính & phí, Huỷ/trả, Giao vận, Affiliate, Livestream & Video, Phân tích vấn đề, Khách hàng khu vực): render từ MỘT payload tổng hợp sẵn của Edge Function `ops-responder` (index.html:4770-4912). Cố định 90 ngày, **không có bộ chọn kỳ, không có biểu đồ xu hướng** (chỉ bảng + KPI + thanh ngang inline).
- **3 màn dùng chung** với vùng khác: `overview` ("Doanh thu & đơn hàng" thực chất mở "Tổng quan kinh doanh" toàn công ty), `ads` (Phân tích Ads — từ RAW.ads của engine Python), `stock` (Quản trị tồn kho ERP).

Hướng kỹ thuật khi đào sâu (không đụng Edge Function): đọc thẳng các bảng `sales_fact`, `ads_fact`, `ads_keyword`, `tonkho`, `sku`, `dim_class` qua Supabase REST từ trình duyệt — RLS đang cho anon đọc, và màn "Ads theo từ khóa" đã làm đúng kiểu này (index.html:4109).

## 2. Audit từng màn hình

| Màn | Đang có | Thiếu / có thể đào sâu | Đề xuất |
|---|---|---|---|
| Tổng quan vận hành (`shopops`) | 6 KPI (GMV gộp, DT sau huỷ, tỷ lệ huỷ, đơn, chi phí Ads+ROAS, giá vốn tồn); top 6 vấn đề; sức khoẻ nguồn; độ phủ API | Payload có sẵn `daily` (GMV/net/huỷ/đơn theo ngày), `ads_products`, `stock_risks`, `data_quality` nhưng KHÔNG hiển thị. Không có biểu đồ nào | Thêm chart xu hướng ngày→tuần GMV/huỷ/đơn từ `p.daily`; khối chất lượng dữ liệu |
| Doanh thu & đơn hàng (`overview`) | Mở trang "Tổng quan kinh doanh" chung toàn công ty (ERP) | Không có màn Shopee riêng: không phễu trạng thái đơn, không xu hướng đơn/AOV Shopee, không top SKU Shopee theo kỳ | Xây khối/màn Shopee riêng từ `sales_fact`: phễu đặt→xuất→giao→hoàn thành, xu hướng, top SKU |
| Tài chính & phí (`shopfinance`) | KPI tiền thực nhận (escrow), tổng phí, DT sau huỷ & phí; bảng 3 loại phí | Chưa dùng: trợ giá seller vs Shopee, voucher shop/Shopee, xu, combo, phí VC (dự kiến/người mua trả/phí trả hàng), tổng tiền người mua trả, ngày thanh toán/ký quỹ. Không có xu hướng phí theo thời gian, không % phí theo tháng | Bổ sung cơ cấu khấu trừ đầy đủ: GMV → trợ giá → voucher → phí sàn → phí VC → thực nhận (waterfall dạng bảng/bar); xu hướng % phí |
| Huỷ, trả & hoàn tiền (`shopreturns`) | 3 KPI (GMV huỷ, đơn huỷ, SP hoàn); bảng top SKU huỷ (từ issues) | `ly_do_huy` chỉ hiện 1 lý do đầu tiên/SKU — chưa có phân bố tỷ lệ huỷ THEO LÝ DO; chưa có tỷ lệ hoàn theo SKU (`so_luong_san_pham_duoc_hoan_tra`/`so_luong`); chưa gắn ABC class/vòng đời; không xu hướng huỷ theo tuần; `trang_thai_tra_hang_hoan_tien`, `ngay_huy_thanh_cong` chưa dùng | Bảng lý do huỷ (đếm đơn + GMV), bảng tỷ lệ hoàn theo SKU gắn class/ABC, chart xu hướng tỷ lệ huỷ |
| Hiệu suất giao vận (`shoplogistics`) | KPI đơn có tracking, giờ chuẩn bị TB, giờ giao TB; bảng theo carrier | `ngay_giao_hang_du_kien` được ops-responder fetch nhưng KHÔNG tính → chưa có tỷ lệ giao đúng hạn vs cam kết; chỉ có trung bình (không P50/P90); chưa dùng `phuong_thuc_giao_hang`, `thoi_gian_giao_hang`; không xu hướng SLA theo tuần | % đúng hạn vs `ngay_giao_hang_du_kien` theo carrier; phân phối P50/P90; xu hướng SLA |
| Ads Shopee (`ads`) | Khá sâu: chi phí/GMV/ROAS theo thời gian (ngày-tuần-tháng tự gộp), bong bóng ROAS×chi phí, heatmap ngành×tháng, bảng SP (spend, GMV, DT thực, ROAS thực, cancel%, ACOS, TACOS, CTR, CVR), khối GMV-Max | Dữ liệu **trực tiếp** (chuyển đổi/SP bán/doanh số trực tiếp — index 3/5/7 trong RAW.ads) hầu như không hiển thị; chưa có CTR theo `vi_tri`; `loai_dich_vu_hien_thi`, `trang_thai`, `phuong_thuc_dau_thau`, `luot_xem_san_pham` chưa dùng | Thêm so sánh trực tiếp vs tổng (cột & toggle); breakdown theo vị trí hiển thị/loại dịch vụ |
| Ads theo từ khóa (`adskw`) | Bảng từ khóa đang chạy (bid, match, status, lượt tìm, điểm CL) + top 25 lượt tìm | **`RAW.ads.kw` (hiệu suất thật theo từ khóa×vị trí: impr, click, spend, GMV, conv — engine đã tính, top 300) KHÔNG được dùng**; chú thích "Shopee không cấp hiệu suất từ khóa" không còn đúng với `ads_fact.tu_khoa_vi_tri`; nút lọc vị trí là nút chết (S.adsKwPlace không dùng khi render — bug) | Bảng "bid vs hiệu quả thật" (join ads_keyword × RAW.ads.kw); sửa bộ lọc vị trí |
| Affiliate (`shopaffiliate`) | KPI (DT, hoa hồng, đơn, publisher, click); top publisher/SP/nội dung | Không có xu hướng theo thời gian; không so với DT toàn shop (% đóng góp) | Thêm % đóng góp + trend nếu dữ liệu theo ngày có trong channel facts |
| Livestream & Video (`shopcontent`) | KPI view/ATC/CTR/đơn; bar div xu hướng view thô; thư viện video (caption, trạng thái, ngày đăng) | Bảng video KHÔNG có số liệu per video (view/ATC/GMV đã có trong `get_video_detail_performance` rows nhưng không hiển thị); chart thô không theo chuẩn Chart.js của dự án | Bảng video kèm view/ATC/đơn/GMV từng video; chart chuẩn |
| Tồn kho Shopee (`stock`) | Mở trang Quản trị tồn kho chung (giá vốn/ngành, kho, brand, báo động đặt hàng) | Không có góc nhìn riêng Shopee: tồn khả dụng vs tốc độ bán Shopee 90 ngày, ngày tồn còn lại | Gộp vào cross-link (P8) thay vì xây màn mới |
| Phân tích vấn đề (`shopissues`) | Bảng issues 4 loại (huỷ cao, Ads lãng phí, tồn chậm, hết hàng) + filter | Thiếu loại cảnh báo chéo: SP đang chạy Ads sắp hết tồn; SP hoàn cao theo class; ngưỡng cố định trong Edge Function (không đổi được) | Bổ sung cảnh báo chéo tính client-side |
| Khách hàng khu vực (`shopregions`) | Bảng tỉnh/thành (GMV, tỷ trọng, đơn, AOV, tỷ lệ huỷ, top SP) + 3 KPI | `phuong_thuc_thanh_toan` chưa dùng (COD vs trả trước × tỷ lệ huỷ); `tp_quan_huyen`/`quan` chưa dùng; không trend khu vực | Khối phương thức thanh toán × huỷ; drill quận/huyện cho top tỉnh |

## 3. Dữ liệu ĐANG CÓ nhưng CHƯA khai thác

**`sales_fact` (66 cột — ops-responder mới dùng 20):**
- Giá & trợ giá: `gia_goc`, `gia_uu_dai`, `nguoi_ban_tro_gia`, `duoc_shopee_tro_gia`, `tong_so_tien_duoc_nguoi_ban_tro_gia`
- Voucher/xu/combo: `ma_giam_gia_cua_shop`, `ma_giam_gia_cua_shopee`, `hoan_xu`, `shopee_xu_duoc_hoan`, `giam_gia_tu_combo_shopee`, `giam_gia_tu_combo_cua_shop`
- Phí vận chuyển: `phi_van_chuyen_du_kien`, `phi_van_chuyen_ma_nguoi_mua_tra`, `phi_tra_hang`
- Thanh toán: `phuong_thuc_thanh_toan`, `tong_so_tien_nguoi_mua_thanh_toan`, `thoi_gian_don_hang_duoc_thanh_toan`, `ngay_xac_minh_ky_quy`
- Vận hành: `ngay_giao_hang_du_kien` (fetch rồi bỏ), `thoi_gian_giao_hang`, `ngay_huy_thanh_cong`, `phuong_thuc_giao_hang`, `loai_don_hang`, `don_hang_duoc_xu_ly_boi_shopee`, `ten_kho_hang`
- Khách: `tp_quan_huyen`, `quan`, `nhan_xet_tu_nguoi_mua`

**`ads_fact`:** nhóm chỉ số *trực tiếp* (`luot_chuyen_doi_truc_tiep`, `san_pham_da_ban_truc_tiep`, `doanh_so_truc_tiep`, `roas/acos_truc_tiep`), `vi_tri`, `tu_khoa_vi_tri`, `loai_tu_khoa`, `trang_thai`, `phuong_thuc_dau_thau`, `luot_xem_san_pham`, `luot_clicks_san_pham`, `ngay_bat_dau/ket_thuc`.

**`ads_keyword`:** đã dùng cho bảng bid, nhưng chưa join với hiệu suất thật; nút lọc vị trí không hoạt động.

**Engine/payload đã tính sẵn mà không màn nào dùng:** `RAW.ads.kw` (hiệu suất từ khóa), chỉ số trực tiếp index 3/5/7 trong RAW.ads, `p.daily`, `p.ads_products`, `p.stock_risks`, `p.data_quality`.

**`sku` + `dim_class` + `tonkho`:** ABC class, phân khúc giá, vòng đời, vai trò SP, mùa vụ — hoàn toàn chưa gắn vào màn Shopee nào; chưa có cross-link Ads × tồn khả dụng.

## 4. Danh sách đề xuất — ĐÁNH SỐ ƯU TIÊN (chờ duyệt)

**Nhóm A — giá trị quyết định cao, dữ liệu có sẵn 100%:**
1. **Huỷ/trả sâu**: phân bố huỷ theo LÝ DO (đơn + GMV), tỷ lệ hoàn theo SKU gắn ABC/vòng đời, xu hướng tỷ lệ huỷ theo tuần. (sales_fact REST)
2. **Tài chính đầy đủ**: chuỗi khấu trừ GMV → trợ giá (seller/Shopee) → voucher/xu/combo → phí sàn → phí VC → thực nhận; xu hướng % phí theo tháng. (sales_fact REST)
3. **Giao vận vs cam kết**: % giao đúng hạn theo `ngay_giao_hang_du_kien`, P50/P90 từng chặng theo carrier, xu hướng SLA tuần. (sales_fact REST)
4. **Ads keyword thật**: bảng hiệu suất từ khóa (impr/click/spend/GMV/conv từ RAW.ads.kw) join bid từ ads_keyword; sửa nút lọc vị trí chết. (dữ liệu đã có trong RAM)
5. **Cảnh báo chéo Ads × tồn**: SP đang chạy Ads mà tồn khả dụng < X tuần bán; SP hoàn/huỷ cao thuộc class/phân khúc nào. (RAW.ads × tonkho × dim_class, client-side)

**Nhóm B — nâng chất màn hiện có:**
6. **Doanh thu & đơn hàng Shopee riêng**: phễu trạng thái đơn, xu hướng GMV/net/đơn/AOV ngày→tuần→tháng, top SKU kỳ chọn. (thay việc trỏ về trang tổng quan chung)
7. **shopops thêm chart**: xu hướng 90 ngày từ `p.daily` + khối `data_quality` + `ads_products`/`stock_risks` đang bị bỏ phí.
8. **Ads trực tiếp vs tổng**: toggle/cột so sánh chuyển đổi & GMV trực tiếp vs tổng; breakdown theo vị trí/loại dịch vụ hiển thị.
9. **Khu vực sâu hơn**: phương thức thanh toán × tỷ lệ huỷ (COD risk), drill quận/huyện top tỉnh.
10. **Video/Affiliate**: bảng video có số liệu per video (view/ATC/GMV); chart chuẩn Chart.js thay bar div; % đóng góp Affiliate vào DT.

**Nhóm C — trải nghiệm chung vùng shop\*:**
11. **Bộ chọn kỳ 30/60/90 ngày** cho các màn shop* (payload cố định 90 ngày → lọc client-side; các khối đọc REST thì lọc trực tiếp).
12. **Chuẩn hoá biểu đồ** toàn vùng theo chuẩn dự án (màu cố định, nhãn điểm quan trọng, gộp ngày→tuần→tháng khi kỳ dài).

## 5. Đề xuất mở rộng dữ liệu (KHÔNG tự làm — cần duyệt riêng, đụng connector)

- `get_return_list/detail` chưa có bản ghi → lý do TRẢ HÀNG chính thức (hiện chỉ suy từ cột hoàn trả của order).
- Escrow chi tiết theo từng đơn có timestamp → đối soát phí theo ngày chính xác hơn (hiện phí lấy từ cột sales_fact).
- Ads hourly (`get_all_cpc_ads_hourly_performance`) → phân tích khung giờ.
- GMS campaign đang rate-limit; Brand Portal thiếu Partner Key/OAuth; Livestream cần uỷ quyền lại (đã ghi trong docs/SHOPEE-DATA-COVERAGE.md).
