"""Ba lớp kiểm tra trước khi cho dữ liệu vào kho.

    Lớp 1 — ĐỊNH DẠNG      sai thì CHẶN CẢ FILE. Thiếu cột bắt buộc, tiêu đề
                            trùng tên mà hợp đồng chưa ghim cột.
    Lớp 2 — NỘI DUNG        sai thì LOẠI DÒNG đó, phần còn lại vẫn nạp.
                            Thiếu khoá, khoá trùng, ô sai kiểu.
    Lớp 3 — LIÊN KẾT CHÉO   sai thì CẢNH BÁO, vẫn nạp. Brand lạ, mã NCC ứng
                            với nhiều tên, thiếu giá vốn, thiếu lead time.

Nguyên tắc: không bao giờ tự sửa dữ liệu của người dùng. Chỉ nhận, loại, hoặc
báo — và luôn nói rõ dòng nào, vì sao.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .contract import Cot, HopDong
from .excel import la_rong


# --------------------------------------------------------------------------
# Kết quả
# --------------------------------------------------------------------------

@dataclass
class ViPham:
    luat: str
    muc_do: str
    ghi_chu: str
    so_dong: List[int] = field(default_factory=list)
    vi_du: List[str] = field(default_factory=list)


@dataclass
class DongBiLoai:
    dong: int
    ly_do: str
    trich: str = ""


@dataclass
class LoiO:
    dong: int
    cot: str
    gia_tri: str
    kieu_mong_doi: str


@dataclass
class KetQua:
    hop_dong: str
    file: str
    sheet: str
    loi_chan_file: List[str] = field(default_factory=list)
    cot_khong_dung_toi: List[str] = field(default_factory=list)
    tong_dong_doc: int = 0
    ban_ghi: List[Dict[str, Any]] = field(default_factory=list)
    dong_bi_loai: List[DongBiLoai] = field(default_factory=list)
    loi_o: List[LoiO] = field(default_factory=list)
    vi_pham: List[ViPham] = field(default_factory=list)

    @property
    def dat(self) -> bool:
        return not self.loi_chan_file

    @property
    def so_dong_nhan(self) -> int:
        return len(self.ban_ghi)


# --------------------------------------------------------------------------
# Lớp 1 — định dạng
# --------------------------------------------------------------------------

def _doi_chieu_tieu_de(hd: HopDong, tieu_de: Dict[str, str]) -> Tuple[Dict[str, str], List[str], List[str]]:
    """Ghép mỗi cột trong hợp đồng với một chữ cái cột trong Excel."""
    theo_ten: Dict[str, List[str]] = {}
    for letter, text in tieu_de.items():
        theo_ten.setdefault(text.strip(), []).append(letter)

    anh_xa: Dict[str, str] = {}
    loi: List[str] = []
    da_dung: set = set()

    for c in hd.cot:
        if c.cot_excel:
            thuc_te = tieu_de.get(c.cot_excel)
            if thuc_te is None:
                loi.append(
                    f"Cột {c.ten_chuan!r} ghim vào ô {c.cot_excel} nhưng cột đó không có tiêu đề."
                )
                continue
            if thuc_te.strip() != c.ten_file.strip():
                loi.append(
                    f"Cột {c.ten_chuan!r} ghim vào {c.cot_excel}: hợp đồng ghi {c.ten_file!r} "
                    f"nhưng file ghi {thuc_te!r}. Cấu trúc file đã đổi — đối chiếu lại trước khi nạp."
                )
                continue
            anh_xa[c.ten_chuan] = c.cot_excel
            da_dung.add(c.cot_excel)
            continue

        ung_vien = theo_ten.get(c.ten_file.strip(), [])
        if len(ung_vien) == 1:
            anh_xa[c.ten_chuan] = ung_vien[0]
            da_dung.add(ung_vien[0])
        elif len(ung_vien) > 1:
            loi.append(
                f"Tiêu đề {c.ten_file!r} xuất hiện ở {len(ung_vien)} cột ({', '.join(ung_vien)}). "
                f"Hệ thống không đoán. Ghim 'cot_excel' cho {c.ten_chuan!r} trong hợp đồng."
            )
        elif c.bat_buoc:
            loi.append(f"Thiếu cột bắt buộc {c.ten_file!r} (→ {c.ten_chuan}).")

    khong_dung = [f"{l} · {tieu_de[l]!r}" for l in sorted(tieu_de) if l not in da_dung]
    return anh_xa, loi, khong_dung


# --------------------------------------------------------------------------
# Lớp 2 — kiểu dữ liệu
# --------------------------------------------------------------------------

def _ep_kieu(gia_tri: Any, kieu: str) -> Tuple[Any, bool]:
    """Trả về (giá trị đã chuẩn hoá, có lỗi hay không). Ô trống không phải lỗi."""
    if la_rong(gia_tri):
        return None, False
    if kieu == "chuoi":
        return str(gia_tri).strip(), False
    try:
        so = float(str(gia_tri).strip().replace(",", ""))
    except (TypeError, ValueError):
        return None, True
    if kieu == "so_nguyen":
        if so != int(so):
            return None, True
        return int(so), False
    return so, False


# --------------------------------------------------------------------------
# Lớp 3 — luật liên kết chéo
# --------------------------------------------------------------------------

def _luat_khong_trung(bg, r) -> List[Tuple[int, str]]:
    cot = r["cot"]
    da_thay: Dict[Any, int] = {}
    ra = []
    for dong, rec in bg:
        v = rec.get(cot)
        if v is None:
            continue
        if v in da_thay:
            ra.append((dong, f"{cot}={v!r} đã xuất hiện ở dòng {da_thay[v]}"))
        else:
            da_thay[v] = dong
    return ra


def _luat_bat_dau_bang(bg, r) -> List[Tuple[int, str]]:
    cot, theo = r["cot"], r["theo"]
    ra = []
    for dong, rec in bg:
        a, b = rec.get(cot), rec.get(theo)
        if a is None or b is None:
            continue
        if not str(a).startswith(str(b)):
            ra.append((dong, f"{cot}={a!r} không bắt đầu bằng {theo}={b!r}"))
    return ra


def _luat_thuoc_danh_sach(bg, r) -> List[Tuple[int, str]]:
    cot = r["cot"]
    cho_phep = {str(x).strip() for x in r["danh_sach"]}
    ra = []
    for dong, rec in bg:
        v = rec.get(cot)
        if v is None:
            continue
        if str(v).strip() not in cho_phep:
            ra.append((dong, f"{cot}={v!r} không có trong danh sách cho phép"))
    return ra


def _luat_anh_xa_mot_mot(bg, r) -> List[Tuple[int, str]]:
    a, b = r["cot_a"], r["cot_b"]
    a_to_b: Dict[Any, set] = {}
    b_to_a: Dict[Any, set] = {}
    for _, rec in bg:
        va, vb = rec.get(a), rec.get(b)
        if va is None or vb is None:
            continue
        a_to_b.setdefault(va, set()).add(vb)
        b_to_a.setdefault(vb, set()).add(va)
    xau = {k for k, v in a_to_b.items() if len(v) > 1}
    xau_b = {k for k, v in b_to_a.items() if len(v) > 1}
    ra = []
    for dong, rec in bg:
        va, vb = rec.get(a), rec.get(b)
        if va in xau:
            ra.append((dong, f"{a}={va!r} ứng với nhiều {b}: {sorted(a_to_b[va])}"))
        elif vb in xau_b:
            ra.append((dong, f"{b}={vb!r} ứng với nhiều {a}: {sorted(b_to_a[vb])}"))
    return ra


def _luat_it_nhat_mot(bg, r) -> List[Tuple[int, str]]:
    cots = r["cot"]
    ra = []
    for dong, rec in bg:
        if all(rec.get(c) in (None, 0) for c in cots):
            ra.append((dong, f"tất cả {', '.join(cots)} đều trống hoặc bằng 0"))
    return ra


def _luat_bat_buoc_co(bg, r) -> List[Tuple[int, str]]:
    cot = r["cot"]
    return [(dong, f"{cot} đang trống") for dong, rec in bg if rec.get(cot) is None]


def _luat_anh_xa_khai_bao(bg, r) -> List[Tuple[int, str]]:
    """Giá trị cột đích phải suy được từ cột nguồn theo bảng khai trong hợp đồng.

    Dùng cho các luật nghiệp vụ dạng "nếu nguồn là X thì đích phải là Y, còn lại
    là Z". Viết ra trong hợp đồng thay vì giấu trong code, nên khi nghiệp vụ đổi
    (có brand thứ ba chẳng hạn) thì sửa đúng một chỗ và được kiểm tra ngay.
    """
    nguon, dich = r["cot_nguon"], r["cot_dich"]
    bang = {str(k).strip(): str(v).strip() for k, v in (r.get("anh_xa") or {}).items()}
    mac_dinh = r.get("mac_dinh")
    ra = []
    for dong, rec in bg:
        vn, vd = rec.get(nguon), rec.get(dich)
        if vd is None:
            continue
        mong_doi = bang.get(str(vn).strip() if vn is not None else "", mac_dinh)
        if mong_doi is None:
            ra.append((dong, f"{nguon}={vn!r} chưa có trong bảng ánh xạ và hợp đồng không khai mặc định"))
        elif str(vd).strip() != str(mong_doi):
            ra.append((dong, f"{nguon}={vn!r} → {dich} phải là {mong_doi!r} nhưng đang là {vd!r}"))
    return ra


LUAT = {
    "khong_trung": _luat_khong_trung,
    "bat_dau_bang": _luat_bat_dau_bang,
    "thuoc_danh_sach": _luat_thuoc_danh_sach,
    "anh_xa_mot_mot": _luat_anh_xa_mot_mot,
    "it_nhat_mot_co_gia_tri": _luat_it_nhat_mot,
    "bat_buoc_co_gia_tri": _luat_bat_buoc_co,
    "anh_xa_khai_bao": _luat_anh_xa_khai_bao,
}


# --------------------------------------------------------------------------

def kiem_tra(hd: HopDong, tieu_de: Dict[str, str], dong: List[Tuple[int, Dict[str, Any]]], ten_file: str) -> KetQua:
    kq = KetQua(hop_dong=hd.ten, file=ten_file, sheet=hd.sheet, tong_dong_doc=len(dong))

    anh_xa, loi, khong_dung = _doi_chieu_tieu_de(hd, tieu_de)
    kq.loi_chan_file = loi
    kq.cot_khong_dung_toi = khong_dung
    if loi:
        return kq  # chặn ở lớp 1, không đọc tiếp dòng nào

    cot_map = hd.cot_theo_ten_chuan

    # ---- lớp 2: dựng bản ghi ----
    tam: List[Tuple[int, Dict[str, Any]]] = []
    for so_dong, o in dong:
        rec: Dict[str, Any] = {}
        for ten_chuan, letter in anh_xa.items():
            c: Cot = cot_map[ten_chuan]
            gia_tri, sai = _ep_kieu(o.get(letter), c.kieu)
            if sai:
                kq.loi_o.append(
                    LoiO(dong=so_dong, cot=ten_chuan, gia_tri=str(o.get(letter))[:60], kieu_mong_doi=c.kieu)
                )
            rec[ten_chuan] = gia_tri

        if rec.get(hd.khoa) is None:
            dai_nhat = max((str(v) for v in o.values()), key=len, default="")
            kq.dong_bi_loai.append(
                DongBiLoai(dong=so_dong, ly_do=f"thiếu khoá {hd.khoa!r}", trich=dai_nhat[:110])
            )
            continue
        tam.append((so_dong, rec))

    # ---- lớp 3: luật chặn dòng trước, luật cảnh báo sau ----
    bi_loai_boi_luat: Dict[int, str] = {}
    for r in hd.luat:
        if r["muc_do"] != "chan_dong":
            continue
        ham = LUAT.get(r["loai"])
        if ham is None:
            kq.loi_chan_file.append(f"Hợp đồng khai luật lạ: {r['loai']!r}")
            return kq
        vp = ham(tam, r)
        if vp:
            kq.vi_pham.append(
                ViPham(
                    luat=r["loai"],
                    muc_do="chan_dong",
                    ghi_chu=str(r.get("ghi_chu", "")).strip(),
                    so_dong=[d for d, _ in vp],
                    vi_du=[f"dòng {d}: {m}" for d, m in vp[:5]],
                )
            )
            for d, m in vp:
                bi_loai_boi_luat.setdefault(d, m)

    con_lai = []
    for so_dong, rec in tam:
        if so_dong in bi_loai_boi_luat:
            kq.dong_bi_loai.append(DongBiLoai(dong=so_dong, ly_do=bi_loai_boi_luat[so_dong]))
        else:
            con_lai.append((so_dong, rec))

    for r in hd.luat:
        if r["muc_do"] != "canh_bao":
            continue
        ham = LUAT.get(r["loai"])
        if ham is None:
            kq.loi_chan_file.append(f"Hợp đồng khai luật lạ: {r['loai']!r}")
            return kq
        vp = ham(con_lai, r)
        if vp:
            kq.vi_pham.append(
                ViPham(
                    luat=r["loai"],
                    muc_do="canh_bao",
                    ghi_chu=str(r.get("ghi_chu", "")).strip(),
                    so_dong=[d for d, _ in vp],
                    vi_du=[f"dòng {d}: {m}" for d, m in vp[:5]],
                )
            )

    kq.ban_ghi = [rec for _, rec in con_lai]
    kq.dong_bi_loai.sort(key=lambda x: x.dong)
    return kq
