# Thư mục `prompt/` — quy trình giao việc cho Claude Code

Thư mục này chứa các file nhiệm vụ (prompt) để giao việc cho Claude Code khi làm việc trên dự án **Sleep Expert Dashboard** (repo này). Mục đích: mỗi khi cần nhờ Claude Code làm một việc, bạn chỉ cần viết yêu cầu ra một file `.md` ở đây, rồi ra một câu lệnh ngắn — Claude Code sẽ tự đọc file và thực hiện đúng theo đó, không cần gõ lại toàn bộ ngữ cảnh mỗi lần.

## 1. Quy ước đặt tên file

```
prompt/YYYY-MM-DD-ten-nhiem-vu.md
```

Ví dụ: `prompt/2026-07-18-cap-nhat-huong-dan-shopee.md`

Dùng ngày + tên ngắn gọn không dấu, cách nhau bằng gạch ngang — dễ sắp xếp theo thời gian và dễ gõ trong câu lệnh.

## 2. Cấu trúc 1 file prompt

Dùng file `_TEMPLATE.md` trong thư mục này làm mẫu. Một prompt tốt nên có đủ:

- **Mục tiêu** — 1-2 câu nói rõ kết quả cuối cùng cần đạt.
- **Bối cảnh** — vì sao cần làm, thông tin nền liên quan (có thể trỏ tới `BAN-GIAO.md` hoặc file khác trong repo thay vì chép lại).
- **Yêu cầu chi tiết** — việc cần làm, càng cụ thể càng tốt (file nào, hàm nào, hành vi trước/sau).
- **Ràng buộc** — những gì KHÔNG được làm hoặc phải giữ nguyên (vd: không tự bịa dữ liệu, không force-push, phải giữ quy ước đặt tên...).
- **Kết quả mong đợi / Tiêu chí hoàn thành** — làm sao biết là xong (test gì, kiểm tra gì, có cần commit + push không).

## 3. Vòng đời 1 file prompt

1. Bạn tạo file mới trong `prompt/` theo mẫu ở trên.
2. Ra lệnh cho Claude Code theo cú pháp ở mục 4.
3. Sau khi Claude Code làm xong và bạn xác nhận ổn, di chuyển file đó vào `prompt/done/` để lưu vết (không xoá, để tra lại lịch sử giao việc).

## 4. Câu lệnh để ra lệnh cho Claude Code

Mở Claude Code **trong đúng thư mục dự án này**, rồi gõ:

```
Đọc file prompt/<tên-file>.md và thực hiện đúng theo yêu cầu trong đó.
```

Ví dụ cụ thể:

```
Đọc file prompt/2026-07-18-cap-nhat-huong-dan-shopee.md và thực hiện đúng theo yêu cầu trong đó.
```

Nếu muốn Claude Code tự tìm việc mới nhất chưa làm (không nhớ tên file):

```
Xem trong thư mục prompt/ có file nhiệm vụ nào chưa chuyển vào prompt/done/, đọc file mới nhất và thực hiện.
```

Nếu có nhiều file cần làm liên tiếp trong 1 phiên:

```
Đọc lần lượt các file trong prompt/ (trừ thư mục done/), thực hiện từng file theo đúng thứ tự ngày trong tên file, xác nhận với tôi trước khi chuyển sang file tiếp theo.
```

## 5. Lưu ý

- Claude Code trên máy này đã có `BAN-GIAO.md` ở gốc repo để nắm bối cảnh chung của dự án — không cần chép lại thông tin đó vào từng prompt, chỉ cần trỏ tới khi liên quan.
- Với việc nhạy cảm (force-push, xoá dữ liệu Supabase, thay đổi cron...), nên ghi rõ trong "Ràng buộc" là phải hỏi xác nhận trước khi làm.
