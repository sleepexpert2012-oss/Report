# Bàn giao dự án — Sleep Expert Dashboard

> File này tóm tắt toàn bộ công việc đã làm trong phiên làm việc với Claude Code, để bạn (hoặc Claude ở máy/phiên khác) nắm được bối cảnh mà không cần đọc lại lịch sử chat. Cập nhật lần cuối: 2026-07-18.

## 1. Dự án này là gì

Dashboard nội bộ 1 file HTML (`index.html`, ~2.8MB) cho Sleep Expert — phân tích bán hàng, tồn kho, Ads Shopee, kế hoạch đặt hàng NCC... Chạy hoàn toàn trong trình duyệt: đọc dữ liệu từ Supabase → dựng lại Excel ảo trong bộ nhớ → chạy engine Python (Pyodide, trong trình duyệt) → render. Không có build step, không server riêng — mở thẳng `index.html` (qua GitHub Pages hoặc local) là chạy.

**Không tự bịa dữ liệu**: mọi số liệu hiển thị đều lấy trực tiếp từ Supabase tại thời điểm mở trang (`_seBoot()` → `_seComputeFromTables()`), không cache, không dùng Excel tĩnh.

## 2. Nơi lưu trữ / triển khai

| Thành phần | Ở đâu |
|---|---|
| Code dashboard + Edge Functions | GitHub: **`sleepexpert2012-oss/Report`** (private), nhánh `main` |
| Trang web live | **https://sleepexpert2012-oss.github.io/Report/** (GitHub Pages, serve `index.html`) |
| Dữ liệu + Edge Functions thật đang chạy | Supabase project ref **`jkrczsrhonmqxwzzdgen`** (region Seoul) |

**Quy ước đã thống nhất với bạn**: mọi sửa `index.html` xong sẽ tự động commit + push GitHub, không hỏi lại. Xác nhận trước khi làm việc phá hoại (force-push, xoá branch...).

**Máy đang dùng không có** Node/npm/npx/brew/psql/Supabase CLI/gh CLI — chỉ có `curl` + `python3`. Mọi thao tác với Supabase (deploy function, chạy SQL, đặt cron) đều làm qua **Supabase Management API** (`https://api.supabase.com/v1/projects/{ref}/...`), cần một **Personal Access Token** (quyền toàn tài khoản) do bạn cấp mỗi lần cần — nên thu hồi ngay sau khi dùng xong tại [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).

## 3. Supabase Edge Functions — LƯU Ý QUAN TRỌNG

Supabase **tự đặt tên ngẫu nhiên** cho function khi tạo — KHÔNG phải tên mô tả như tài liệu cũ (`shopee-auth`, `shopee-sync`) ghi. Tên thật (slug) đã xác minh và có bản sao lưu trong git tại `shopee-connector/functions/<slug>/index.ts`:

| Slug thật | Chức năng | Ghi vào bảng |
|---|---|---|
| `swift-handler` | Ủy quyền OAuth **đơn hàng** | `shopee_token` |
| `smooth-responder` | **Đồng bộ đơn hàng** → dashboard | `sales_fact`, `shopee_sync_state` |
| `swift-task` | Ủy quyền OAuth **Ads** | `shopee_ads_token` |
| `bright-responder` | **Đồng bộ chi phí/hiệu suất Ads** | `ads_fact`, `shopee_ads_state` |
| `smart-endpoint` | Đồng bộ **từ khóa Ads** | `ads_keyword` |

Chi tiết đầy đủ + cách deploy lại: xem `shopee-connector/functions/README.md`.

### 3.1 Đồng bộ đơn hàng (`smooth-responder`)
- Có nhớ tiến độ qua bảng `shopee_sync_state` (mỗi shop: `next_from`, `done`).
- Tự giới hạn ~110 giây/lần chạy (tránh timeout) — nếu chưa xong sẽ trả trang HTML tự refresh để chạy tiếp.
- Sau khi đồng bộ hết lịch sử lần đầu: mỗi lần chạy chỉ làm mới **30 ngày gần nhất** (xoá theo từng mã đơn rồi ghi lại — KHÔNG xoá sạch bảng). Trước đó là 15 ngày, đã đổi theo yêu cầu.

### 3.2 Đồng bộ Ads (`bright-responder`) — đã sửa 2 lần trong phiên này
1. **Vấn đề phát hiện**: chi phí Ads trong dashboard (18tr) thấp hơn app seller (18.7tr) vì cách kéo cũ chỉ liệt kê campaign **cấp sản phẩm** (`get_product_level_campaign_*`), bỏ sót một số loại (SP mới, GMS, CPC cấp shop...).
2. **Đã sửa**: sau khi kéo xong campaign sản phẩm như cũ, gọi thêm `GET /api/v2/ads/get_all_cpc_ads_daily_performance` (API trả tổng chi phí/doanh số cấp **TOÀN SHOP**, khớp app seller gần như tuyệt đối — đã kiểm chứng: 18.727.489đ so với 18.723.686đ, lệch 0.02%). Phần **chênh lệch mỗi ngày** giữa tổng shop và tổng đã kéo theo sản phẩm được ghi thành 1 dòng `"CPC khác (chưa phân bổ SP)"` — để tổng `ads_fact` khớp thật, mà bảng breakdown theo sản phẩm không bị ảnh hưởng.
3. **Đã deploy live** (version 4). Đã test: chạy xong tổng tháng 7 tăng đúng từ 17.9tr → 18.1tr rồi → sau vài lần chạy đối soát đạt ~18.72tr.

### 3.3 Cron (pg_cron) — tất cả gọi function public, không cần Authorization header
| Job | Lịch (UTC) | Giờ VN | Gọi |
|---|---|---|---|
| `shopee-sync-daily` | `0 23,5,13 * * *` | 06:00 / 12:00 / 20:00 | `smooth-responder` |
| `shopee-ads-daily` | `10 23,5,13 * * *` | 06:10 / 12:10 / 20:10 | `bright-responder` |
| `shopee-ads-kw-daily` | `20 23 * * *` | 06:20 | `smart-endpoint` |

Trước phiên này **chỉ có** cron đơn hàng — Ads hoàn toàn chạy tay, nên hay bị cũ (đây cũng là 1 phần lý do số liệu Ads lệch app seller ở thời điểm bạn hỏi).

## 4. Công thức NMV / ROAS thực trong màn Ads — đã thay đổi cách tính

**Vấn đề cũ**: cột "NMV" = `GMV_ads × (1 − tỷ lệ hủy lịch sử của SKU)` — một ước tính dựa trên GMV Shopee tự gắn cho quảng cáo (tính theo "mọi đơn của shop trong 7 ngày sau khi click ad", kể cả đơn sau đó bị hủy, kể cả đơn của sản phẩm khác). Ước tính này có thể sai lệch rất xa thực tế — ví dụ Power X Fusion từng hiện NMV 2.6tr trong khi doanh thu **hoàn thành thật** = 0 (2 đơn thật của SP này đã hoàn thành từ nhiều tháng trước khi Ads chạy).

**Đã sửa (commit `0e2eb55`)**: đổi hẳn sang lấy **doanh thu thật** — chỉ tính đơn **Hoàn thành**, đã trừ hàng hoàn trả, từ `sales_fact`, khớp đúng theo class/kỳ đang xem (biến `realRevM`/`realByPgM`, vốn có sẵn trong engine, trước đây chỉ dùng cho TACOS).

- KPI **"NMV (thực)"** đổi tên thành **"DT thực (net)"**.
- **ROAS thực** = DT thực ÷ chi ads (phản ánh đúng hiệu quả tài chính thật, không phải ROAS Shopee tự tính).
- Bỏ KPI **"% DT nhờ ads"** và cột **"%ads"** trong bảng sản phẩm (dựa trên GMV tracking không đáng tin, không còn cần khi đã có DT thực).
- Tỷ lệ hủy đơn (KPI) giờ tính độc lập (tỷ lệ hủy thật của shop / bình quân gia quyền theo GMV ads của class) — không còn suy ngược từ NMV/GMV.
- Bảng "Hiệu suất theo sản phẩm": cột NMV → **"DT thực"**; cờ cảnh báo mới **"Chi, DT thực=0"** (đã chi tiền quảng cáo nhưng SP không có đơn hoàn thành thật nào) thay cho cờ "Chi mà GMV=0" cũ; cờ "ROAS thấp" đổi thành **"ROAS thực thấp"** dùng ROAS thực.
- Các chỉ số tracking gốc của Ads (GMV ads, ROAS gộp, CTR, lượt hiển thị/click...) **giữ nguyên**, không đổi — theo đúng yêu cầu tách bạch "số Shopee tự đo" và "kết quả tài chính thật".

## 5. Các sửa giao diện khác trong phiên này

- **Bảng "Phân bổ kế hoạch theo ngày"** (tab S&OP): thống nhất cỡ chữ (trước lộn xộn 9–10.5px), làm nổi bật rõ 2 dòng Tổng tuần/Tổng tháng (viền + nền navy đậm).
- **Nút "Lưu kế hoạch"**: chuyển từ cuối trang lên đầu màn "Lập kế hoạch Ads", làm rõ nó lưu TOÀN BỘ màn hình (ngân sách Ngành/Class + phân bổ theo ngày), không chỉ phần ngày.
- **2 biểu đồ "Chi phí·GMV·ROAS theo thời gian" và "Xu hướng chỉ số theo thời gian"** (trang tổng quan Ads):
  - Sửa lỗi trục Ngày hiện `undefined/undefined` (do tách chuỗi ngày sai dấu phân cách).
  - Sửa lỗi **nhãn số bị nhân nhầm 1000 lần** (vd "9.150 tr" thay vì "9,2tr") — do dùng chung công thức định dạng với các trang khác có quy ước đơn vị khác (tỷ→triệu), trong khi dữ liệu Ads đã tính sẵn theo triệu.
  - Sửa **màu bị trùng khó phân biệt** giữa các chỉ số (trước đó 8 màu đều là các sắc thái navy/tím gần giống nhau). Giờ mỗi chỉ số có 1 màu cố định, phân biệt rõ (đã kiểm tra bằng script mô phỏng mù màu đỏ-lục, không chỉ nhìn bằng mắt) — cùng 1 chỉ số thì cùng màu ở cả 2 biểu đồ.
  - Giảm rối mắt: nhãn số trên đường/cột giờ chỉ hiện ở điểm đỉnh + đảm bảo khoảng cách tối thiểu, không hiện dày đặc mọi điểm dữ liệu.

## 6. Việc còn để ngỏ / có thể làm tiếp

- 2 file `shopee-connector/HUONG-DAN.md` và `HUONG-DAN-CHI-TIET.md` **đã lạc hậu** — còn ghi tên function cũ (shopee-auth/shopee-sync) và biến môi trường không còn dùng. Chưa cập nhật lại (cân nhắc việc này nếu cần dùng để hướng dẫn người khác).
- Local preview server (`python3 -m http.server 8420`) dùng để xem thử trước khi push — nếu tắt VS Code/máy thì cần khởi động lại (`cd` vào thư mục dự án rồi chạy lại lệnh trên).
- CodeGraph (MCP) đã cài cho Claude Code trên máy này, nhưng **không đọc được `index.html`** (chỉ index code `.ts`) — không giúp được nhiều cho việc sửa dashboard.

## 7. Ghi nhớ đã lưu cho Claude (memory)

Nếu tiếp tục làm việc bằng Claude Code **trên đúng máy này**, các ghi nhớ sau đã có sẵn (không cần đọc lại file này để khôi phục context — Claude tự đọc):
`github_repo_setup.md`, `auto_push_preference.md`, `dev_environment.md`, `supabase_shopee_sync.md`, `interface_preference.md`.

Nếu chuyển sang **máy khác / môi trường Claude Code khác**, các file ghi nhớ đó KHÔNG tự đi theo — file `BAN-GIAO.md` này (nằm trong repo, tự động có mặt khi clone) chính là thứ thay thế để Claude ở môi trường mới đọc và nắm bối cảnh nhanh.
