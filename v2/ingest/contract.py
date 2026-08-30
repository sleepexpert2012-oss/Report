"""Đọc hợp đồng dữ liệu từ file YAML trong v2/contracts/.

Hợp đồng là nguồn sự thật duy nhất về việc "file Excel phải trông thế nào".
Code không được chứa luật nghiệp vụ nào mà hợp đồng không nói ra.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml


KIEU_HOP_LE = {"chuoi", "so", "so_nguyen"}
MUC_DO_HOP_LE = {"chan_dong", "canh_bao"}


@dataclass
class Cot:
    ten_file: str
    ten_chuan: str
    kieu: str = "chuoi"
    bat_buoc: bool = False
    cot_excel: Optional[str] = None


@dataclass
class HopDong:
    ten: str
    sheet: str
    dong_tieu_de: int
    khoa: str
    cot: List[Cot]
    luat: List[Dict[str, Any]] = field(default_factory=list)
    mo_ta: str = ""
    nguon: str = ""
    duong_dan: Optional[Path] = None

    @property
    def cot_theo_ten_chuan(self) -> Dict[str, Cot]:
        return {c.ten_chuan: c for c in self.cot}


def doc_hop_dong(path: Path) -> HopDong:
    du_lieu = yaml.safe_load(Path(path).read_text(encoding="utf-8"))

    thieu = [k for k in ("ten", "sheet", "dong_tieu_de", "khoa", "cot") if k not in du_lieu]
    if thieu:
        raise ValueError(f"Hợp đồng {path.name} thiếu mục bắt buộc: {', '.join(thieu)}")

    cot: List[Cot] = []
    for i, c in enumerate(du_lieu["cot"], start=1):
        if "ten_file" not in c or "ten_chuan" not in c:
            raise ValueError(f"Hợp đồng {path.name}: cột thứ {i} thiếu ten_file hoặc ten_chuan")
        kieu = c.get("kieu", "chuoi")
        if kieu not in KIEU_HOP_LE:
            raise ValueError(
                f"Hợp đồng {path.name}: cột {c['ten_chuan']!r} khai kiểu {kieu!r}; "
                f"chỉ chấp nhận {', '.join(sorted(KIEU_HOP_LE))}"
            )
        cot.append(
            Cot(
                ten_file=str(c["ten_file"]),
                ten_chuan=str(c["ten_chuan"]),
                kieu=kieu,
                bat_buoc=bool(c.get("bat_buoc", False)),
                cot_excel=(str(c["cot_excel"]).upper() if c.get("cot_excel") else None),
            )
        )

    ten_chuan = [c.ten_chuan for c in cot]
    trung = {t for t in ten_chuan if ten_chuan.count(t) > 1}
    if trung:
        raise ValueError(f"Hợp đồng {path.name}: ten_chuan bị trùng: {', '.join(sorted(trung))}")

    khoa = str(du_lieu["khoa"])
    if khoa not in ten_chuan:
        raise ValueError(f"Hợp đồng {path.name}: khoá {khoa!r} không nằm trong danh sách cột")

    luat = du_lieu.get("luat") or []
    for i, r in enumerate(luat, start=1):
        if "loai" not in r:
            raise ValueError(f"Hợp đồng {path.name}: luật thứ {i} thiếu 'loai'")
        muc_do = r.get("muc_do", "canh_bao")
        if muc_do not in MUC_DO_HOP_LE:
            raise ValueError(
                f"Hợp đồng {path.name}: luật {r['loai']!r} khai mức độ {muc_do!r}; "
                f"chỉ chấp nhận {', '.join(sorted(MUC_DO_HOP_LE))}"
            )
        r["muc_do"] = muc_do

    return HopDong(
        ten=str(du_lieu["ten"]),
        sheet=str(du_lieu["sheet"]),
        dong_tieu_de=int(du_lieu["dong_tieu_de"]),
        khoa=khoa,
        cot=cot,
        luat=luat,
        mo_ta=str(du_lieu.get("mo_ta", "")).strip(),
        nguon=str(du_lieu.get("nguon", "")).strip(),
        duong_dan=Path(path),
    )
