# Bàn giao sang tài khoản mới — Sleep Expert Data App

> Cập nhật: 27/07/2026  
> Bản phát hành hiện tại: **R51**  
> Git commit: **`cd6dca3`**  
> Mục đích: giúp tài khoản Codex/GitHub/Supabase mới tiếp tục dự án mà không cần đọc lại lịch sử chat.

## 1. Đọc phần này trước

1. Không ghi Partner Key, access token, refresh token, Supabase secret key hoặc GitHub token vào file, commit hay nội dung chat.
2. File `BAN-GIAO.md` cũ đang có thay đổi riêng chưa commit. Không ghi đè, reset hoặc đưa file đó vào commit nếu chưa được người dùng xác nhận.
3. Thư mục `prompt/` đang là dữ liệu local chưa track. Không tự thêm vào Git.
4. Quy trình làm việc hiện tại: sửa → kiểm tra/preview → báo người dùng duyệt → chỉ push khi người dùng nói rõ “push/pub”.
5. Không tự bịa số liệu. Dữ liệu báo cáo phải đến từ Supabase/Shopee API; nguồn chưa kết nối phải hiện trạng thái chờ hoặc bị chặn.

### Cảnh báo quyền Supabase hiện tại

Ngày 27/07/2026, CLI vẫn nhận đúng project ref nhưng tài khoản đang đăng nhập trả:

```text
403: Your account does not have the necessary privileges to access this endpoint
```

Lỗi xảy ra với:

- `supabase functions list`
- `supabase migration list --linked`
- `supabase secrets list`

Đây là lỗi quyền tài khoản Supabase, không phải lỗi Edge Function. Tài khoản mới phải được mời vào đúng organization/project với quyền đủ để quản lý Database, Edge Functions và Secrets, sau đó đăng nhập lại CLI.

## 2. Hệ thống đang chạy ở đâu

| Thành phần | Giá trị |
|---|---|
| GitHub repository | `sleepexpert2012-oss/Report` |
| Git remote | `git@github.com:sleepexpert2012-oss/Report.git` |
| Nhánh production | `main` |
| Website production | https://sleepexpert2012-oss.github.io/Report/ |
| Supabase project ref | `jkrczsrhonmqxwzzdgen` |
| Supabase URL | `https://jkrczsrhonmqxwzzdgen.supabase.co` |
| File giao diện chính | `index.html` |
| Phiên bản production | R51 — commit `cd6dca3` |

Dashboard là ứng dụng HTML/JavaScript lớn, không có bước build frontend. GitHub Pages phục vụ trực tiếp `index.html`.

## 3. Việc cần làm trên tài khoản mới

### 3.1 GitHub

1. Mời tài khoản mới vào repository `sleepexpert2012-oss/Report` với quyền Write hoặc cao hơn.
2. Tài khoản mới đăng nhập GitHub CLI:

```bash
gh auth login
gh auth status
```

3. Xác minh quyền:

```bash
git remote -v
git fetch origin
git push --dry-run origin main
```

4. Kiểm tra GitHub Pages vẫn trỏ vào nhánh `main`.
5. Kiểm tra GitHub Actions secrets:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Không in giá trị hai secrets này ra terminal hoặc chat.

### 3.2 Supabase

1. Trong Supabase Dashboard, mời tài khoản mới vào organization chứa project `jkrczsrhonmqxwzzdgen`.
2. Cấp quyền đủ để:
   - xem/chạy SQL và migrations;
   - deploy Edge Functions;
   - xem tên và cập nhật Edge Function Secrets;
   - kiểm tra logs và cron.
3. Tài khoản mới đăng nhập và link lại:

```bash
supabase logout
supabase login
supabase link --project-ref jkrczsrhonmqxwzzdgen
```

4. Xác minh quyền đã đúng:

```bash
supabase functions list --project-ref jkrczsrhonmqxwzzdgen
supabase migration list --linked
supabase secrets list --project-ref jkrczsrhonmqxwzzdgen
```

Nếu vẫn trả 403, dừng triển khai và sửa quyền thành viên trước. Không tạo project Supabase mới để “né” lỗi, vì token OAuth, dữ liệu và cron thật đều nằm trong project hiện tại.

### 3.3 Shopee Open Platform

Tài khoản Shopee/Open Platform mới phải truy cập được các app hiện tại. Partner ID không phải bí mật, nhưng Partner Key là bí mật và phải nhập trực tiếp vào Supabase Secrets.

| App | Live Partner ID | Trạng thái |
|---|---:|---|
| Data Sale / Seller In House | `2039280` | Đang dùng cho order, product, tồn kho, payment, returns, logistics |
| Data Ads / Ads Service | `2039279` | Đang dùng |
| Affiliate Marketing Solution | `2039927` | Đã OAuth và đồng bộ |
| Shopee Video Management | `2039928` | Đã OAuth và đồng bộ |
| Livestream Management | `2039925` | Cần OAuth lại |
| Brand Portal Service | `2039929` | Chưa có Partner Key/OAuth ở backend |
| Seller Logistics | `2039924` | App đã tạo; dữ liệu logistics hiện đọc được qua Data Sale |
| Consignment Service System | `2039923` | Chưa dùng trong báo cáo hiện tại |

Không xoá/unlink các app cũ trước khi xác nhận tài khoản mới có quyền quản trị và đã sao lưu cấu hình cần thiết.

## 4. Secrets cần tồn tại

Chỉ kiểm tra **tên**, không sao chép giá trị ra file.

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

SHOPEE_HOST
SHOPEE_START_DATE
SHOPEE_PUBLIC_CALLBACK_BASE
SHOPEE_ALLOW_EMPTY_INVENTORY_SYNC

SHOPEE_PARTNER_ID
SHOPEE_PARTNER_KEY
SELF_URL

SHOPEE_ADS_PARTNER_ID
SHOPEE_ADS_PARTNER_KEY
ADS_SELF_URL

SHOPEE_AFFILIATE_PARTNER_ID
SHOPEE_AFFILIATE_PARTNER_KEY

SHOPEE_VIDEO_PARTNER_ID
SHOPEE_VIDEO_PARTNER_KEY

SHOPEE_LIVE_PARTNER_ID
SHOPEE_LIVE_PARTNER_KEY
```

Brand Portal còn cần bổ sung:

```text
SHOPEE_BRAND_PARTNER_ID=2039929
SHOPEE_BRAND_PARTNER_KEY=<nhập trực tiếp trong Supabase>
```

Sau khi thay đổi Partner Key hoặc tài khoản sở hữu app, phải OAuth lại app tương ứng. Không sao chép access/refresh token thủ công giữa hai project.

## 5. Edge Functions production

Code nguồn được lưu tại:

```text
shopee-connector/functions/<slug>/index.ts
```

| Function | Nhiệm vụ |
|---|---|
| `swift-handler` | OAuth Data Sale |
| `smooth-responder` | Đồng bộ order và sales |
| `inventory-responder` | Đồng bộ tồn theo kho và dữ liệu Product mở rộng |
| `swift-task` | OAuth Data Ads |
| `bright-responder` | Đồng bộ Ads daily/campaign và đối soát tổng shop |
| `smart-endpoint` | Từ khóa Ads, balance, toggle, recommended item, hourly/GMS |
| `ops-sync` | Payment, returns, shipment, tracking, shop metadata |
| `ops-responder` | Tổng hợp API thành payload cho các màn hình vận hành |
| `shopee-app-auth` | OAuth Affiliate, Video, Livestream |
| `shopee-channel-sync` | Đồng bộ Affiliate, Video và phần Livestream có thể đọc |

### Cách deploy an toàn

Repo lưu function dưới `shopee-connector/functions`, trong khi Supabase CLI mặc định tìm ở `supabase/functions`. Các lần trước đã deploy bằng thư mục staging tạm, không di chuyển source thật.

Ví dụ:

```bash
stage_dir=$(mktemp -d /tmp/shopee-deploy.XXXXXX)
mkdir -p "$stage_dir/supabase/functions/ops-responder"
cp supabase/config.toml "$stage_dir/supabase/config.toml"
cp shopee-connector/functions/ops-responder/index.ts \
  "$stage_dir/supabase/functions/ops-responder/index.ts"

supabase functions deploy ops-responder \
  --project-ref jkrczsrhonmqxwzzdgen \
  --no-verify-jwt \
  --use-api \
  --workdir "$stage_dir"
```

Xoá thư mục staging sau khi deploy. Không dùng `--prune`.

## 6. Database và migrations

Project dùng migration kiểu imperative trong:

```text
supabase/migrations/
```

Các migration đang có trong repo:

| Migration | Mục đích |
|---|---|
| `20260726090000_shopee_channel_data.sql` | Token app và bảng fact Affiliate/Video/Live |
| `20260726180000_shopee_user_token.sql` | Thêm `user_id` cho app dạng User OAuth |
| `20260726233000_shopee_full_sync.sql` | Kho API thô và checkpoint đồng bộ |

Hai bảng mới của R51:

- `shopee_api_fact`: lưu dữ liệu API thô theo app/module/endpoint/scope/entity.
- `shopee_sync_checkpoint`: lưu trạng thái, số trang, số dòng, lần thành công, lỗi và lịch retry.

RLS đã bật và quyền `anon`, `authenticated` đã bị revoke trên bảng token/fact/checkpoint nhạy cảm. Frontend không được dùng service-role key; chỉ Edge Functions sử dụng key này.

Các bảng dữ liệu chính:

```text
sales_fact
ads_fact
ads_keyword
tonkho
dim_kho
shopee_token
shopee_ads_token
shopee_app_token
shopee_channel_fact
shopee_api_fact
shopee_sync_state
shopee_ads_state
shopee_sync_checkpoint
```

## 7. Tình trạng dữ liệu tại R51

Kết quả kiểm chứng gần nhất trước khi bàn giao:

| Nhóm | Tình trạng |
|---|---|
| Affiliate | 14/14 luồng đang cấu hình thành công, có phân trang |
| Shopee Video | 63/63 luồng theo 14 video thành công |
| Product | 6/6 nhóm dữ liệu thành công |
| Ads keyword | 1.424 từ khóa của 16 sản phẩm |
| Tồn kho | 1.059 unit: WH01 839, WH02 83, WH03 135, WH04 2 |
| Shop / Order / Logistics | Shop info, profile, warehouse, shipment, tracking và channel đã kết nối |
| Payment | Escrow, income overview và wallet đã kết nối |
| GMS item | Bị chặn/không áp dụng với dữ liệu shop hiện tại |
| Payout detail | Chỉ áp dụng cross-border shop, không áp dụng shop nội địa này |
| GMS campaign | Lần kiểm tra gần nhất bị Shopee rate-limit; checkpoint giữ trạng thái retry |
| Returns | API list đã kết nối nhưng kỳ kiểm tra không có yêu cầu trả/hoàn |

Đây là độ phủ các **luồng đã cấu hình**, không có nghĩa toàn bộ catalog Shopee Open API đã được khai thác.

## 8. Các màn hình đã hoàn thiện ở R51

- Tổng quan vận hành Shopee.
- Doanh thu và đơn hàng.
- Tài chính và phí Shopee.
- Huỷ, trả và hoàn tiền.
- Hiệu suất giao vận.
- Ads Shopee, từ khóa và kế hoạch Ads.
- Affiliate với KPI, top publisher, sản phẩm và content.
- Shopee Video với KPI, ATC thật, xu hướng và thư viện video.
- Tồn kho theo kho.
- Nhật ký release/API/data freshness.
- Bảng sức khoẻ nguồn dữ liệu và độ phủ endpoint.

Chỉ số ATC trên Video là dữ liệu thật từ Video API. Không được thay bằng công thức ước tính từ click.

## 9. Việc còn mở

### 9.1 Livestream Management

- Token Live hiện cần OAuth lại.
- Mở:

```text
https://jkrczsrhonmqxwzzdgen.supabase.co/functions/v1/shopee-app-auth?app=live
```

- API Livestream cần `session_id`; catalog hiện không có endpoint liệt kê toàn bộ lịch sử phiên Seller Centre.
- Sau OAuth, kiểm tra `shopee_app_token` có `app_key=live` và `user_id`.

### 9.2 Brand Portal

- Cần nhập Brand Partner Key vào Supabase Secrets.
- Cần hoàn thiện OAuth loại Principal và lưu `principal_id`.
- Sau đó mới gọi được nhóm `/api/v2/principal/*` cho sale, Affiliate, Live và Video cấp principal/shop.

### 9.3 API đọc chưa triển khai hết

Đọc ma trận chi tiết tại:

```text
docs/SHOPEE-DATA-COVERAGE.md
```

Các phần đáng ưu tiên:

- Order package search/detail.
- Payment income detail/report và billing transaction.
- Returns detail/reverse tracking khi có return thực tế.
- Logistics shipping parameter/tracking number nếu báo cáo cần.
- Video detail metric trend theo từng metric.
- Affiliate validation report và targeted campaign settings.

## 10. Cron và snapshot

Cron Supabase đã được thiết kế chạy theo giờ Việt Nam:

| Giờ VN | Tác vụ |
|---|---|
| 06:00 / 12:00 / 20:00 | Order/sales |
| 06:10 / 12:10 / 20:10 | Ads |
| 06:20 | Ads keyword |
| 06:25 / 12:25 / 20:25 | Inventory |
| 06:35 / 12:35 / 20:35 | GitHub Action dựng dashboard snapshot |

Workflow snapshot:

```text
.github/workflows/build-dashboard-snapshot.yml
```

Sau khi tài khoản mới có quyền Supabase, phải kiểm tra lại cron trong database thay vì chỉ tin vào tài liệu.

## 11. Kiểm tra nhanh sau khi tiếp quản

```bash
git status --short
git log -5 --oneline
node --check /tmp/dashboard-main.js
```

Kiểm tra website:

```bash
curl -fsSL https://sleepexpert2012-oss.github.io/Report/ | grep R51
```

Kiểm tra responder:

```bash
curl -sS -X POST \
  https://jkrczsrhonmqxwzzdgen.supabase.co/functions/v1/ops-responder \
  -H 'Content-Type: application/json' \
  --data '{}' | jq '{ok, error, coverage: .payload.api_coverage}'
```

Kiểm tra từng đồng bộ chỉ sau khi quyền và secrets đã xác nhận:

```bash
curl -sS -X POST \
  https://jkrczsrhonmqxwzzdgen.supabase.co/functions/v1/shopee-channel-sync \
  -H 'Content-Type: application/json' \
  --data '{"app":"affiliate","days":30}' | jq
```

Không chạy đồng thời nhiều lượt full sync khi chưa biết rate limit của Shopee.

## 12. Quy tắc release

1. Mỗi bản production tăng số `R` trong:
   - `CHANGELOG.md`;
   - thẻ release trong `index.html`;
   - bảng lịch sử cập nhật;
   - footer.
2. Kiểm tra JavaScript:

```bash
main_start=$(rg -n '^<script>$' index.html | tail -1 | cut -d: -f1)
main_end=$(rg -n '^</script>$' index.html | tail -1 | cut -d: -f1)
sed -n "$((main_start+1)),$((main_end-1))p" index.html > /tmp/dashboard-main.js
node --check /tmp/dashboard-main.js
git diff --check
```

3. Chỉ stage file thuộc thay đổi đang làm. Không dùng `git add .`.
4. Không reset hoặc xoá thay đổi của người dùng.
5. Chỉ push khi người dùng duyệt.
6. Sau push, xác minh GitHub Pages đã hiện số R mới.

## 13. Tài liệu nên đọc theo thứ tự

1. `BAN-GIAO-TAI-KHOAN-MOI.md` — file này.
2. `CHANGELOG.md` — các release R50 trở đi.
3. `docs/SHOPEE-DATA-COVERAGE.md` — ma trận API và khoảng trống.
4. `shopee-connector/functions/README.md` — function và cron nền.
5. `supabase/migrations/` — schema R51.
6. `index.html` — giao diện production.
7. `BAN-GIAO.md` — bối cảnh cũ; có thể chứa thông tin đã lạc hậu, phải đối chiếu code hiện tại.

## 14. Tóm tắt cho AI/tài khoản mới

```text
Bạn đang tiếp quản Sleep Expert Data App, production R51, commit cd6dca3.
Repo: sleepexpert2012-oss/Report, branch main.
Live: https://sleepexpert2012-oss.github.io/Report/
Supabase: jkrczsrhonmqxwzzdgen.

Trước khi làm:
- đọc BAN-GIAO-TAI-KHOAN-MOI.md;
- chạy git status và không đụng BAN-GIAO.md/prompt nếu không được giao;
- xác nhận quyền Supabase vì tài khoản trước đang bị 403;
- không ghi secrets/token vào chat hoặc Git;
- sửa và preview trước, chỉ push khi người dùng duyệt.

Việc còn chính: OAuth lại Livestream, cấu hình Brand Portal Principal,
sau đó tiếp tục các endpoint còn thiếu trong docs/SHOPEE-DATA-COVERAGE.md.
```
