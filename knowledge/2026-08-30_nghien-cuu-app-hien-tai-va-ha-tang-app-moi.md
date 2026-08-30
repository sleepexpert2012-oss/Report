# Nghiên cứu app hiện tại & hạ tầng cho app mới

> Ngày: 30/08/2026 · Phạm vi: đọc toàn bộ `index.html`, `scripts/`, `shopee-connector/`, schema Supabase, snapshot production đang chạy.
> Mục đích: rút ra bằng được cách app hiện tại **trình bày** và **đào sâu insight**, tách rõ cái đáng giữ khỏi di sản Vua Nệm, rồi chốt hạ tầng cho app viết lại.
> Không sửa gì trong lần này.

---

## A. Bối cảnh xác lập được bằng bằng chứng

App hiện tại được dựng lại từ dashboard của Vua Nệm. Câu này không còn là phỏng đoán — nó nằm ngay trong docstring của engine, `index.html:4769`:

```
window._PY_ENGINE = "...
"""Sinh toàn bộ object RAW cho Sleep Expert (đúng schema VuaNem dashboard)."""
```

Engine đó là **1,45 MB mã Python nhúng dưới dạng chuỗi JSON trong HTML**. `scripts/build_snapshot.py` trích chuỗi này ra rồi `exec()` nó mỗi giờ trên GitHub Actions; trình duyệt cũng chạy chính nó qua Pyodide khi người dùng import Excel. Toàn bộ khái niệm dữ liệu của app đều do khối chuỗi này định nghĩa.

**Dữ liệu thì sạch.** 9 bảng nguồn trên Supabase đều là của Sleep Expert: 147 SKU, 2.839 dòng `sales_fact` (15/01/2025 → 29/08/2026), 7 brand thật (POWER X, AP WOOD, HAPPYTOWN SLEEPTECH, HUY HOÀNG NAM, EVERHOME, TEXNAM), 4 kho WH01–WH04 đồng bộ từ Shopee Product API. Không lẫn dữ liệu công ty khác.

**Cái lẫn là logic và khung màn hình.** Xem mục C.

---

## B. 12 điều đáng học — và phải mang sang app mới

Đây là phần giá trị nhất của app hiện tại. Nó không nằm ở code, nằm ở **ngữ pháp trình bày** đã được mài qua 81 bản phát hành.

### B1. Mọi con số đều đi theo cặp: kỳ chọn ↔ kỳ so sánh
Không có màn nào hiện một con số trần. `cmpRange()` cho phép 4 chế độ: kỳ liền trước · cùng kỳ năm trước · tự chọn · không so sánh. Đây là mặc định của hệ thống, không phải tính năng thêm.

### B2. Lệch độ dài kỳ thì phải nói ra, và phải quy đổi
`kf()` quy đổi kỳ so sánh về bình quân/tháng khi hai kỳ khác độ dài; `periodTxt()` bật cảnh báo `⚠ khác độ dài — Δ quy đổi TB/tháng` (`index.html:1531`). Rất ít dashboard làm việc này — hầu hết so 90 ngày với 60 ngày rồi im lặng.

### B3. Một công tắc chỉ số đổi toàn bộ biểu đồ
`S.metric` có 4 giá trị: Doanh thu · Số lượng · GP · GM%. Mọi biểu đồ và sparkline đọc chung công tắc này (`seriesFor()`, `barUpd()`, `YLBL()`). Người dùng học một lần, dùng ở mọi màn.

### B4. Ngữ pháp cột bảng cố định
`numCols` (`index.html:1496`) định nghĩa đúng một trật tự cột dùng lại khắp app:

```
DT kỳ SS → DT kỳ chọn → Δ → %Δ → GM% → ASP → COGS/u → Unit
```

Đọc bảng nào cũng thấy cùng thứ tự, cùng cách tô màu `pos`/`neg`, cùng quy ước "Mới" khi kỳ trước bằng 0. Đây là thứ khiến app đọc nhanh.

### B5. Dải thời gian tự chọn mức chi tiết
`_adAutoGran()` (`index.html:4140`): kỳ ≤ 1 tháng → theo **Ngày**, 2–4 tháng → theo **Tuần**, ≥ 5 tháng → theo **Tháng**. Người dùng vẫn đổi tay được sau đó. Không có nó, chọn 12 tháng sẽ ra biểu đồ 365 cột vô nghĩa.

### B6. Gom tuần bằng cộng dồn ngày thật, tuyệt đối không nội suy
`_adWeekAgg()` chỉ cộng những ngày **đang có** trong dữ liệu, nên tổng tuần luôn bằng tổng ngày. Có memo theo chữ ký `class|kỳ` để không tính lại. Comment trong code ghi rõ: *"không bịa/không nội suy"*.

### B7. Pareto 80% để tách "hàng xương sống" khỏi phần đuôi
`renderInd()` đánh dấu `_key` cho tập class chiếm 80% doanh thu ngành. Người đọc biết ngay 6 dòng đầu quyết định cả ngành, 40 dòng sau là nhiễu.

### B8. Biểu đồ đổi chiều phân tích theo ngành hàng
Ô biểu đồ thứ ba của màn Ngành hàng không cố định: ngành Đệm → **size mix**, Chăn ga → **chất liệu**, còn lại → **brand** (`index.html:2461–2483`). Cùng một ô, câu hỏi khác nhau tuỳ ngành. Đây là hiểu nghiệp vụ, không phải kỹ thuật.

### B9. Khung trả lời 5 phần — tài sản lớn nhất về insight
`_aiCard()` (`index.html:4999`) ép mọi câu trả lời vào đúng một cấu trúc:

| Mục | Vai trò | Nguyên tắc |
|---|---|---|
| 📌 Tóm tắt | số liệu thô + so kỳ trước | chỉ báo cáo, không diễn giải |
| 💡 Insight | cái gì đáng chú ý | mover lớn nhất, rủi ro tập trung |
| 🔎 Nguyên nhân **có thể** | giả thuyết | luôn gắn chữ "có thể", không khẳng định |
| ✅ Đề xuất hành động | việc làm được | **mỗi việc kèm mức ưu tiên Cao/TB/Thấp** |
| 📊 KPI cần theo dõi | đo sau khi làm | khép vòng |

Khung này tách bạch *báo cáo → diễn giải → khuyến nghị*, đúng nguyên tắc phân tích. Nó phải được giữ nguyên ở app mới; chỉ thay phần ruột (hiện là regex + vài phép tính tháng gần nhất).

### B10. Ngưỡng nằm trong dữ liệu, không nằm trong code
`RAW.ads.thr.roasHi` / `roasLo` được nạp từ snapshot, không hard-code trong hàm vẽ. Đổi ngưỡng không cần sửa app.

### B11. Trạng thái rỗng là một màn hình có nội dung
`renderWarn()` khi không có cảnh báo không hiện bảng trắng, mà hiện: *"Không có cảnh báo — mọi SKU bán ra đều có trong danh mục."* Người đọc biết đây là **kết quả tốt**, không phải lỗi tải dữ liệu.

> Đính chính so với nhận định sơ bộ trước đó: `RAW.warn = []` **không phải** màn chết. Đó là trạng thái rỗng hợp lệ — 147 SKU bán ra đều đã khai báo. Màn này hoạt động đúng.

### B12. In ấn là một chế độ hiển thị thật, không phải Ctrl+P
Có hẳn khối `@media print` riêng (`index.html:149–166`): ẩn nav/filter, ép `page-break-inside:avoid` cho card/bảng/biểu đồ, `@page{margin:12mm}`, thu nhỏ bảng Ads xuống 7,3px để vừa khổ, hiện `#printHead` chỉ khi in. App được thiết kế để mang vào phòng họp bản giấy.

**Hai điều nữa nằm ở tầng dữ liệu, cũng phải mang sang:**

- **Một nơi tính duy nhất.** `scripts/revenue_rules.py` là nơi duy nhất định nghĩa doanh thu/COGS, có unit test, có đối chiếu thật với Kiot. Cách phân bổ giảm giá seller (đọc một lần mỗi đơn, clamp theo GMV đơn, chia theo tỷ trọng, **dòng cuối nhận phần dư**) đảm bảo tổng SKU khớp tuyệt đối tổng đơn — chi tiết nhỏ nhưng là thứ giữ cho mọi bảng cân.
- **Cổng tươi dữ liệu.** `sync_shopee_pipeline.py` bắt mọi checkpoint phải mới hơn thời điểm bắt đầu lần chạy; không đạt thì **không publish**, giữ nguyên snapshot cũ. Thà số cũ còn hơn số nửa cũ nửa mới.

---

## C. Không mang sang — kèm bằng chứng

| Hạng mục | Vị trí | Vì sao |
|---|---|---|
| Engine Python nhúng dạng chuỗi 1,45 MB + `exec()` | `index.html:453`, `build_snapshot.py:run_engine` | Không đọc được, không test được, không review được; chạy `exec()` mã lấy từ HTML ở cả server lẫn trình duyệt |
| Lead time & nguồn hàng theo brand Vua Nệm | `index.html:1862–1866` | `defLTsrc()` gán lead time theo `Tempur`, `Bedgear`, `Spring Air`, `Amando`, `Goodnight`, `Dunlopillo`, `Gummi`, `Comfy`, `7zones`, `Legend` — **không brand nào của SE khớp**, nên 100% SKU rơi vào fallback 30 ngày/`both`. Kế hoạch tồn kho đang chạy trên tham số của công ty khác |
| Chuẩn hoá brand của Vua Nệm | `index.html:3739, 3745, 3759` | `if(br==='iComfy')br='Comfy'`; gộp `Doona`→`Amando` |
| RAW nhúng cứng trong file | `index.html:1216` (128 KB) | Một bản dữ liệu đông cứng 2025.01–2026.07 làm fallback; dễ hiểu nhầm là dữ liệu thật khi Supabase lỗi |
| 22 khoá RAW rỗng của mô hình chuỗi cửa hàng | snapshot production | `storeStat · psStore · psStoreTB · psCodes · nStoresTotal · vpo · vend · vcl · lastPO · cpo · cpoMulti · skuPO · clsStat · clsSku · classCov · skuCov · codeCost · szs · gidYear · fcYoY` — SE không có chuỗi cửa hàng vật lý và không nuôi dữ liệu PO |
| Màn chạy trên các khoá rỗng đó | `renderSupOverview`, `renderSupMatrix`, `renderStores`, `renderTBNem`, `renderNewCov` | Quản lý NCC và Tồn kho theo cửa hàng đang là vỏ rỗng |
| ~700 dòng render của 8 màn Shopee đã bị R81 gỡ khỏi nav | `_ops2Ops/_ops2Orders/_ops2Returns/_ops2Logistics/_ops2Regions/_ops2Issues/_opsAffiliate/_opsVideo/_opsAffiliateV1` | Không còn đường gọi tới; đúng cái bẫy `LESSONS.md` đã ghi |
| Cổng đăng nhập hash djb2 | cuối `index.html` | `h(v)===1432633302` ngay trong client |
| Sinh HTML bằng nối chuỗi + `innerHTML` | toàn app | Không escape, không kiểm kiểu |
| Hai Edge Function cùng ghi `sales_fact` | `ops-sync`, `smooth-responder` | Hai người ghi một bảng → sẽ lệch dần |

---

## D. Hạ tầng app mới — 7 tầng, mỗi tầng một hợp đồng

Nguyên tắc xuyên suốt: **mỗi tầng chỉ nói chuyện với tầng kề, qua một hợp đồng viết ra được.** Sai ở đâu biết ngay ở đó.

```
L0  Sổ đăng ký nguồn      mỗi bảng: nguồn · ai ghi · tần suất · cửa sổ lịch sử · kéo lại được không
L1  Nạp (ingest)          mỗi bảng ĐÚNG MỘT writer · ghi thô, không tính toán
L2  Chuẩn hoá (rules)     module thuần, có test, KHÔNG chạm UI — nơi duy nhất định nghĩa nghiệp vụ
L3  Kho (raw/dim/fact)    raw giữ nguyên bản để truy vết · dim/fact chuẩn hoá tên cột
L4  Phục vụ (serve)       snapshot cho tổng quan · query trực tiếp cho drill-down
L5  Trình bày (UI)        design token + component · không có phép tính nghiệp vụ nào
L6  Insight               3 tầng tách rời: tính → phát hiện → diễn giải
```

**Ba cổng chắn bắt buộc, kế thừa từ app cũ:**

1. **Cổng tươi** — không nguồn nào cũ thì không publish (đã có, giữ nguyên).
2. **Cổng đối chiếu** — mỗi lần đổi định nghĩa nghiệp vụ phải đối chiếu ít nhất 1 kỳ với báo cáo gốc trước khi công bố.
3. **Cổng nhất quán** — test khẳng định mọi màn dùng chung một khái niệm phải ra **cùng một con số** (bài học `LESSONS.md` 29/07).

**Quy tắc riêng cho L6 (insight), rút từ B9:**
- Tầng 1 **tính**: chỉ số + so kỳ, thuần số học, có test biên (rỗng, âm, 1 phần tử).
- Tầng 2 **phát hiện**: luật ngưỡng đọc từ cấu hình, không hard-code; ra danh sách `{điều bất thường, mức độ, bằng chứng}`.
- Tầng 3 **diễn giải**: chỉ nhận kết quả đã tính của tầng 1–2, **không được chạm dữ liệu thô và không được tự tính số**. Mọi con số trong câu trả lời phải khớp số đầu vào — kiểm bằng eval.

---

## E. Việc còn phải chốt trước khi code

1. **Nền tảng frontend** — hosting hiện tại là GitHub Pages (tĩnh, miễn phí) + Supabase. Chọn stack phải giữ được ràng buộc này hoặc chấp nhận đổi hosting.
2. **Xác thực** — thay hash dùng chung bằng Supabase Auth thật hay giữ nguyên?
3. **Phạm vi màn hình** — dựng lại toàn bộ, hay bắt đầu từ cụm lõi (Tổng quan → Ngành/Brand → Tài chính P&L → Ads → Tồn kho) rồi mở rộng?
4. **Quản lý NCC / Tồn kho theo cửa hàng** — SE có nuôi dữ liệu thật không, hay bỏ hẳn khỏi app mới?
