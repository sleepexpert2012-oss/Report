"""Báo cáo nạp — thứ người nạp đọc để biết chuyện gì vừa xảy ra.

Nguyên tắc trình bày: nói con số trước, rồi mới nói chi tiết; mỗi vấn đề phải
chỉ được ra dòng nào trong file Excel để người nạp mở lên sửa được ngay.
"""

from __future__ import annotations

from .validate import KetQua

GACH = "─" * 72


def _muc(tieu_de: str) -> str:
    return f"\n{tieu_de}\n{GACH}"


def in_bao_cao(kq: KetQua, chi_tiet: int = 10) -> str:
    d = []
    d.append(GACH)
    d.append(f"BÁO CÁO NẠP · {kq.hop_dong}")
    d.append(f"File   : {kq.file}")
    d.append(f"Sheet  : {kq.sheet}")
    d.append(GACH)

    if not kq.dat:
        d.append("\n❌ CHẶN — file không đúng cấu trúc, chưa nạp dòng nào.\n")
        for l in kq.loi_chan_file:
            d.append(f"   • {l}")
        d.append("\nSửa file (hoặc sửa hợp đồng nếu cấu trúc đổi có chủ đích) rồi chạy lại.")
        return "\n".join(d)

    nhan, loai = kq.so_dong_nhan, len(kq.dong_bi_loai)
    d.append("")
    d.append(f"   Đọc được   : {kq.tong_dong_doc} dòng")
    d.append(f"   Nhận        : {nhan} dòng")
    d.append(f"   Loại        : {loai} dòng")

    if kq.dong_bi_loai:
        d.append(_muc("DÒNG BỊ LOẠI — không ghi vào kho"))
        for r in kq.dong_bi_loai[:chi_tiet]:
            d.append(f"   dòng {r.dong:>4} · {r.ly_do}")
            if r.trich:
                d.append(f"              nội dung: {r.trich}")
        if loai > chi_tiet:
            d.append(f"   … và {loai - chi_tiet} dòng nữa")

    if kq.loi_o:
        d.append(_muc("Ô SAI KIỂU — đã để trống ô đó, dòng vẫn được nhận"))
        for e in kq.loi_o[:chi_tiet]:
            d.append(f"   dòng {e.dong:>4} · {e.cot}: {e.gia_tri!r} không phải {e.kieu_mong_doi}")
        if len(kq.loi_o) > chi_tiet:
            d.append(f"   … và {len(kq.loi_o) - chi_tiet} ô nữa")

    canh_bao = [v for v in kq.vi_pham if v.muc_do == "canh_bao"]
    if canh_bao:
        d.append(_muc("CẢNH BÁO — vẫn nạp, nhưng cần biết"))
        for v in canh_bao:
            d.append(f"\n   ⚠ {v.luat} — {len(v.so_dong)} dòng")
            if v.ghi_chu:
                d.append(f"     {v.ghi_chu}")
            for ex in v.vi_du:
                d.append(f"       · {ex}")
            if len(v.so_dong) > len(v.vi_du):
                d.append(f"       … và {len(v.so_dong) - len(v.vi_du)} dòng nữa")

    if kq.cot_khong_dung_toi:
        d.append(_muc("CỘT TRONG FILE MÀ HỢP ĐỒNG KHÔNG DÙNG TỚI"))
        for c in kq.cot_khong_dung_toi:
            d.append(f"   • {c}")
        d.append("   (nếu là cột mới cần dùng thì bổ sung vào hợp đồng)")

    if not kq.dong_bi_loai and not canh_bao and not kq.loi_o:
        d.append("\n✅ Sạch — không có dòng bị loại, không có cảnh báo.")

    d.append("")
    return "\n".join(d)
