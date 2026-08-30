# Quy chuẩn giao diện — Sleep Expert Data App v2

> Louis chốt ngày 30/08/2026, sau khi xem năm hướng dựng thành màn Tổng quan thật.
> Hướng được chọn: **1 · Chàm chuẩn**.
> Nơi cài đặt duy nhất: `v2/app/src/styles.css`, khối `:root`.
> **Không viết mã màu trực tiếp ở bất kỳ file nào khác.**

---

## 1. Màu — đo từ logo, không chọn cảm tính

Hai màu gốc lấy bằng cách đếm điểm ảnh trên `Brand Assets/Logo/SleepExpert Logo_opt4.png`:

| | Hex | Diện tích logo | Tương phản trên trắng | Được dùng làm |
|---|---|---|---|---|
| Chàm | `#353E99` | 87,7% | **9,13:1** | chữ, tiêu đề, số, đường kẻ biểu đồ, nền thanh menu |
| Lavender | `#C3C0D7` | 11,1% | **1,77:1** | **chỉ** nền khối, viền, nét phụ |

> **Luật cứng:** không bao giờ đặt chữ lavender lên nền trắng. 1,77:1 là không đọc được với người mắt kém.

### Bộ token

| Token | Hex | Vai trò |
|---|---|---|
| `--ground` | `#F6F6FA` | nền trang, xám ngả nhẹ về sắc chàm |
| `--surface` | `#FFFFFF` | nền thẻ |
| `--surface-sunk` | `#EDEEF4` | nền chìm: đầu bảng, chú giải |
| `--ink` | `#16182E` | chữ chính — 17,0:1 |
| `--ink-soft` | `#3D4055` | chữ phụ đậm |
| `--muted` | `#6B6E82` | chữ phụ — 4,9:1 |
| `--line` | `#E2E2EC` | đường kẻ |
| `--line-soft` | `#EEEEF4` | kẻ trong bảng |
| `--accent` | `#353E99` | chàm thương hiệu |
| `--accent-soft` | `#E8E9F5` | nền chàm nhạt |
| `--warn` | `#8A5F14` | thiếu dữ liệu — 4,8:1 |
| `--crit` | `#B3261E` | chỉ số xấu đi |
| `--good` | `#1F7A5C` | chỉ số tốt lên |
| `--rail` | `#2A3179` | nền thanh menu |

Màu trạng thái (`--warn`, `--crit`, `--good`) **được giữ riêng**, không bao giờ dùng làm màu chuỗi dữ liệu thứ tư.

## 2. Màu biểu đồ

```
--c1 #5560CC   --c2 #12A08D   --c3 #C77A14   --c4 #C0435C   --c5 #8A5BD6
```

Đã chạy qua bộ kiểm tra tự động của skill `dataviz` và **đạt cả 5 mục**: dải sáng · độ tươi ·
tách biệt cho người mù màu (ΔE nhỏ nhất 10,2) · tách biệt cho mắt thường (ΔE 16,0) · tương phản với nền.

**Vì sao không dùng thẳng `#353E99` cho biểu đồ:** máy báo lỗi ngay ở mục dải sáng — màu logo
quá tối để tô mảng. `#5560CC` là bậc sáng hơn cùng tông, giữ được mạch nhận diện. `#353E99` vẫn
dùng để kẻ đường xu hướng và viết chữ.

Luật gán màu:
- Gán theo **thứ tự cố định**, không xoay vòng. Chuỗi thứ 6 thì gộp vào "Khác", không sinh màu mới.
- Màu bám theo **thực thể**, không bám theo thứ hạng. Lọc bớt chuỗi thì các chuỗi còn lại giữ nguyên màu.
- **Không bao giờ hai trục y** trên một biểu đồ. Hai đại lượng khác thang thì tách hai biểu đồ.
- Chữ luôn mặc màu chữ (`--ink`, `--muted`), **không bao giờ mặc màu chuỗi**.

## 3. Chữ

| Vai trò | Font |
|---|---|
| Giao diện, tiêu đề, thân bài | **Be Vietnam Pro** — thiết kế riêng cho tiếng Việt, dấu không vỡ |
| Mã SKU, số liệu, nhãn kỹ thuật | **IBM Plex Mono** — chữ đều bề rộng nên so cột số theo chiều dọc rất nhanh |

### Thang cỡ

| Bậc | px | Đậm | Dòng | Giãn chữ |
|---|---|---|---|---|
| Tiêu đề màn (`h1`) | 28 | 600 | 1,15 | −0,022em |
| Tiêu đề khối (`h2`) | 15 | 600 | 1,4 | −0,008em |
| Thân bài (`body`) | 13,5 | 400 | 1,55 | 0 |
| Nhãn (`.eyebrow`, nhãn ô lọc) | 11 | 500 | 1,4 | +0,02em, chữ hoa |
| Số liệu lớn (`.stat .v`) | 23 | 500 | 1,2 | −0,02em, IBM Plex Mono |
| Trong bảng | 13 | 400 | — | mã và số dùng Mono 12,5 |

## 4. Thanh menu

- **Logo** đặt trên cùng, rộng 132px. Dùng bản trắng `public/logo-trang.png` sinh từ logo gốc:
  màu chàm đổi thành trắng đặc, màu lavender đổi thành trắng mờ 42% để vầng trăng sau chữ *e*
  vẫn đọc được trên nền tối. Toàn bộ hình giữ nguyên nhờ kênh alpha.
- Rộng **212px**, nền `--rail`.
- Mỗi mục cao **40px**: biểu tượng 17px + khoảng cách 11px + nhãn **14px**.
- Mục đang mở: chữ trắng, đậm 600, nền sáng hơn 11%, vạch trắng 2px bên trái.
- Mục dùng được: **trắng `#FFFFFF`** — 11,6:1 trên nền thanh menu.
- Mục chưa dựng: `#C3C8E8` — 7,0:1. Vẫn đọc rõ, chỉ khác sắc độ để phân biệt.
- Tiêu đề nhóm: IBM Plex Mono 9,5px, giãn chữ 0,14em, chữ hoa, cùng màu `#C3C8E8`.

> Bản đầu dùng `#A9AED6` cho mục thường và `#7D84BD` cho mục chưa dựng. Đo lại thì
> `#7D84BD` chỉ đạt **3,26:1** — dưới chuẩn AA cho chữ thường. Đã sửa. Bài học: màu chữ
> trên nền tối phải đo, đừng tin mắt.

**Biểu tượng dùng SVG nét vẽ, không dùng emoji** — emoji đổi hình theo hệ điều hành nên mỗi máy
nhìn một kiểu. Toàn bộ dùng chung độ dày nét 1,6 và bo đầu tròn. Định nghĩa tại `v2/app/src/icons.tsx`.

## 5. Khoảng cách

`4 · 8 · 12 · 16 · 24 · 32 · 48` (px), khai bằng `--sp-1` đến `--sp-7`.
Đây là thang dày, hợp màn nhiều dữ liệu. Không dùng giá trị ngoài thang.

## 6. Bảng

- Đầu bảng dính khi cuộn dọc; **cột đầu dính khi cuộn ngang** — cuộn tới cột nào cũng biết đang xem mã nào.
- Cột số căn phải, dùng Mono.
- Ô trống hiện dấu **"—"** màu nhạt, **không bao giờ hiện "0"**. Trống khác không.
- Bo góc thẻ 9px, ô lọc và nút 5px.

## 7. Nguyên tắc viết chữ trên giao diện

- Gọi tên theo thứ người dùng nhận ra, không theo cách hệ thống được xây.
- Nút nói đúng việc nó làm, và tên giữ nguyên suốt luồng.
- Màn trống là lời mời hành động, không phải chỗ để trống.
- Báo lỗi nói **sai gì và sửa thế nào**, không xin lỗi, không nói mơ hồ.

## 8. Đã kiểm chứng

Mọi cặp màu chữ/nền của hướng này đã được trình duyệt tự đo — **không cặp nào dưới chuẩn AA**.
Xem lại tại `v2/design/huong-dan-giao-dien.html` (thang chữ, bảng màu, tương phản) và
`v2/design/tong-quan-5-huong.html` (màn Tổng quan dựng đủ biểu đồ bằng số liệu thật).
