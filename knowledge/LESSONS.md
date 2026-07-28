# Bài học tích lũy — Data App

Mỗi entry: ngày · việc · sai gì · sửa gì · rule rút ra.

---

## 2026-07-28 · Thêm bộ chọn "từ tháng → đến tháng" cho Vùng Vận hành Shopee

**Sai gì:** Dùng find-and-replace hàng loạt `_ops2Win(SF,S.opsDays)` → `_ops2Wsel(SF)` trên toàn file. Phép thay thế đụng luôn dòng nằm BÊN TRONG thân hàm `_ops2Wsel` (dòng fallback về chế độ ngày) → hàm tự gọi chính nó → đệ quy vô hạn. `node --check` vẫn PASS vì cú pháp hoàn toàn hợp lệ; lỗi chỉ lộ ra khi chạy thật, và hậu quả là treo trình duyệt ở MỌI màn vận hành.

**Sửa gì:** Trả dòng fallback bên trong `_ops2Wsel` về `_ops2Win(SF,S.opsDays)`; viết test node với dữ liệu giả lập 9 tháng để chạy thật các hàm chọn kỳ.

**Rule rút ra:**
1. Đếm số lần thay thế và ĐỐI CHIẾU với số call site đã grep trước đó — lệch 1 là dấu hiệu đụng nhầm chỗ (ở đây grep ra 5, replace báo 6).
2. Khi hàm mới có fallback gọi hàm cũ, luôn kiểm tra phép thay thế có đụng thân hàm mới không.
3. `node --check` chỉ bắt lỗi cú pháp, KHÔNG bắt lỗi logic/đệ quy. Với logic tính toán (chọn kỳ, gộp nhóm, công thức) phải trích hàm ra chạy thử bằng node với dữ liệu giả lập — gồm cả ca biên: khoảng đảo ngược, 1 phần tử, rỗng, giá trị không tồn tại.
