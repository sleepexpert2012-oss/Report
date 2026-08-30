"""Test cho lớp nạp.

Chạy: cd v2 && python3 -m tests.test_validate

Mỗi test khoá lại một hành vi mà nếu vỡ thì dữ liệu bẩn sẽ lọt vào kho.
Dữ liệu test là dữ liệu bịa, cố ý — không đụng file thật.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest.contract import Cot, HopDong
from ingest.validate import kiem_tra


def _hop_dong(cot, luat=None) -> HopDong:
    return HopDong(
        ten="Test", sheet="S", dong_tieu_de=1, khoa="sku", cot=cot, luat=luat or []
    )


def _chay(cot, tieu_de, dong, luat=None):
    return kiem_tra(_hop_dong(cot, luat), tieu_de, dong, ten_file="test.xlsx")


COT_CO_BAN = [
    Cot(ten_file="SKU", ten_chuan="sku", bat_buoc=True),
    Cot(ten_file="Tên", ten_chuan="ten"),
]


def test_tieu_de_trung_thi_chan_file():
    """Hai cột cùng tên mà hợp đồng không ghim → phải CHẶN, tuyệt đối không đoán.

    Đây chính là ca đã làm hỏng dữ liệu thật: sheet SKU có hai cột 'Brand',
    một là brand, một là tên nhà cung cấp.
    """
    cot = [Cot(ten_file="Brand", ten_chuan="brand", bat_buoc=True)]
    kq = _chay(cot, {"A": "Brand", "B": "Brand"}, [])
    assert not kq.dat, "Tiêu đề trùng mà vẫn cho nạp — sai"
    assert "ghim" in " ".join(kq.loi_chan_file).lower()
    assert kq.so_dong_nhan == 0


def test_ghim_cot_thi_phan_giai_duoc_tieu_de_trung():
    cot = [
        Cot(ten_file="SKU", ten_chuan="sku", bat_buoc=True),
        Cot(ten_file="Brand", ten_chuan="brand", cot_excel="B", bat_buoc=True),
        Cot(ten_file="Brand", ten_chuan="ncc", cot_excel="C", bat_buoc=True),
    ]
    kq = _chay(
        cot,
        {"A": "SKU", "B": "Brand", "C": "Brand"},
        [(2, {"A": "X1", "B": "POWER X", "C": "HAPPYTOWN"})],
    )
    assert kq.dat, kq.loi_chan_file
    assert kq.ban_ghi[0]["brand"] == "POWER X"
    assert kq.ban_ghi[0]["ncc"] == "HAPPYTOWN"


def test_ghim_sai_cot_thi_chan():
    """Cấu trúc file đổi (cột dịch chỗ) phải bị chặn, không âm thầm lấy nhầm."""
    cot = [Cot(ten_file="Brand", ten_chuan="brand", cot_excel="B", bat_buoc=True)]
    kq = _chay(cot, {"A": "Brand", "B": "Supplier Code"}, [])
    assert not kq.dat
    assert "Cấu trúc file đã đổi" in " ".join(kq.loi_chan_file)


def test_thieu_cot_bat_buoc_thi_chan():
    kq = _chay(COT_CO_BAN, {"A": "Tên"}, [(2, {"A": "abc"})])
    assert not kq.dat
    assert "Thiếu cột bắt buộc" in " ".join(kq.loi_chan_file)


def test_dong_thieu_khoa_bi_loai_va_giu_lai_noi_dung():
    """Dòng ghi chú của người làm Excel phải bị loại, kèm trích nội dung."""
    ghi_chu = "↑ 143 SKU gốc + 3 SKU HỒNG — xem màn Cảnh báo"
    kq = _chay(
        COT_CO_BAN,
        {"A": "SKU", "B": "Tên"},
        [(2, {"A": "X1", "B": "Nệm"}), (3, {"B": ghi_chu})],
    )
    assert kq.dat
    assert kq.so_dong_nhan == 1
    assert len(kq.dong_bi_loai) == 1
    assert kq.dong_bi_loai[0].dong == 3
    assert ghi_chu[:20] in kq.dong_bi_loai[0].trich


def test_chu_None_duoc_coi_la_o_trong():
    """Lần xuất dữ liệu trước ghi chữ 'None' vào ô — không được hiểu là giá trị."""
    kq = _chay(COT_CO_BAN, {"A": "SKU", "B": "Tên"}, [(2, {"A": "X1", "B": "None"})])
    assert kq.ban_ghi[0]["ten"] is None


def test_khoa_trung_bi_loai_ban_ghi_sau():
    luat = [{"loai": "khong_trung", "cot": "sku", "muc_do": "chan_dong", "ghi_chu": ""}]
    kq = _chay(
        COT_CO_BAN,
        {"A": "SKU", "B": "Tên"},
        [(2, {"A": "X1"}), (3, {"A": "X1"}), (4, {"A": "X2"})],
        luat,
    )
    assert kq.so_dong_nhan == 2
    assert [r.dong for r in kq.dong_bi_loai] == [3]


def test_anh_xa_mot_mot_bat_duoc_ma_ncc_ung_hai_ten():
    """Ca thật: SUVN0001 ứng với cả HUY HOÀNG NAM lẫn AP WOOD."""
    cot = COT_CO_BAN + [
        Cot(ten_file="Mã NCC", ten_chuan="ncc_ma"),
        Cot(ten_file="Tên NCC", ten_chuan="ncc_ten"),
    ]
    luat = [{"loai": "anh_xa_mot_mot", "cot_a": "ncc_ma", "cot_b": "ncc_ten", "muc_do": "canh_bao", "ghi_chu": ""}]
    kq = _chay(
        cot,
        {"A": "SKU", "B": "Tên", "C": "Mã NCC", "D": "Tên NCC"},
        [
            (2, {"A": "X1", "C": "SUVN0001", "D": "HUY HOÀNG NAM"}),
            (3, {"A": "X2", "C": "SUVN0001", "D": "AP WOOD"}),
            (4, {"A": "X3", "C": "SUVN0002", "D": "HAPPYTOWN"}),
        ],
        luat,
    )
    assert kq.so_dong_nhan == 3, "cảnh báo thì vẫn phải nạp đủ"
    vp = [v for v in kq.vi_pham if v.luat == "anh_xa_mot_mot"]
    assert len(vp) == 1 and sorted(vp[0].so_dong) == [2, 3]


def test_anh_xa_khai_bao_bat_brand_sai_theo_ncc():
    """Luật brand: SUCN0001 → POWER X, mọi NCC khác → TUFT & NEEDLE."""
    cot = COT_CO_BAN + [
        Cot(ten_file="Supplier Code", ten_chuan="supplier_code"),
        Cot(ten_file="Brand (thương hiệu)", ten_chuan="brand"),
    ]
    luat = [{
        "loai": "anh_xa_khai_bao", "cot_nguon": "supplier_code", "cot_dich": "brand",
        "anh_xa": {"SUCN0001": "POWER X"}, "mac_dinh": "TUFT & NEEDLE",
        "muc_do": "canh_bao", "ghi_chu": "",
    }]
    kq = _chay(
        cot,
        {"A": "SKU", "B": "Tên", "C": "Supplier Code", "D": "Brand (thương hiệu)"},
        [
            (2, {"A": "X1", "C": "SUCN0001", "D": "POWER X"}),        # đúng
            (3, {"A": "X2", "C": "SUVN0002", "D": "TUFT & NEEDLE"}),  # đúng
            (4, {"A": "X3", "C": "SUVN0002", "D": "POWER X"}),        # SAI
            (5, {"A": "X4", "C": "SUCN0001", "D": "TUFT & NEEDLE"}),  # SAI
        ],
        luat,
    )
    assert kq.so_dong_nhan == 4, "cảnh báo thì vẫn nạp đủ"
    vp = [v for v in kq.vi_pham if v.luat == "anh_xa_khai_bao"]
    assert len(vp) == 1 and sorted(vp[0].so_dong) == [4, 5]


def test_anh_xa_khai_bao_bao_khi_ncc_moi_chua_khai():
    """NCC mới chưa có trong bảng ánh xạ và không khai mặc định → phải báo."""
    cot = COT_CO_BAN + [
        Cot(ten_file="Supplier Code", ten_chuan="supplier_code"),
        Cot(ten_file="Brand (thương hiệu)", ten_chuan="brand"),
    ]
    luat = [{
        "loai": "anh_xa_khai_bao", "cot_nguon": "supplier_code", "cot_dich": "brand",
        "anh_xa": {"SUCN0001": "POWER X"}, "muc_do": "canh_bao", "ghi_chu": "",
    }]
    kq = _chay(
        cot,
        {"A": "SKU", "B": "Tên", "C": "Supplier Code", "D": "Brand (thương hiệu)"},
        [(2, {"A": "X1", "C": "SUVN9999", "D": "BRAND MỚI"})],
        luat,
    )
    vp = [v for v in kq.vi_pham if v.luat == "anh_xa_khai_bao"]
    assert len(vp) == 1 and vp[0].so_dong == [2]
    assert "chưa có trong bảng ánh xạ" in vp[0].vi_du[0]


def test_o_sai_kieu_khong_lam_mat_ca_dong():
    cot = COT_CO_BAN + [Cot(ten_file="Cao", ten_chuan="cao", kieu="so")]
    kq = _chay(cot, {"A": "SKU", "B": "Tên", "C": "Cao"}, [(2, {"A": "X1", "C": "8/10"})])
    assert kq.so_dong_nhan == 1
    assert kq.ban_ghi[0]["cao"] is None
    assert len(kq.loi_o) == 1 and kq.loi_o[0].cot == "cao"


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    hong = 0
    for t in tests:
        try:
            t()
            print(f"  ✓ {t.__name__}")
        except AssertionError as e:
            hong += 1
            print(f"  ✗ {t.__name__}: {e}")
    print(f"\n{len(tests) - hong}/{len(tests)} test đạt")
    sys.exit(1 if hong else 0)
