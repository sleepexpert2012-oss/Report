"""Chạy kiểm tra một file Excel theo hợp đồng.

    python3 -m ingest.cli --hop-dong contracts/sku-master.yaml --file <đường dẫn .xlsx>

Thêm --json <đường dẫn> để ghi bản ghi đã nhận ra file, phục vụ bước nạp vào kho.
Lệnh này KHÔNG ghi gì lên database — kiểm tra và báo cáo thôi.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .contract import doc_hop_dong
from .excel import doc_sheet
from .report import in_bao_cao
from .validate import kiem_tra


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Kiểm tra file Excel theo hợp đồng dữ liệu")
    p.add_argument("--hop-dong", required=True, type=Path, help="file YAML trong contracts/")
    p.add_argument("--file", required=True, type=Path, help="file .xlsx cần kiểm tra")
    p.add_argument("--json", type=Path, help="ghi các bản ghi đã nhận ra file JSON")
    p.add_argument("--chi-tiet", type=int, default=10, help="số dòng ví dụ hiển thị mỗi mục")
    a = p.parse_args(argv)

    hd = doc_hop_dong(a.hop_dong)
    try:
        tieu_de, dong = doc_sheet(a.file, hd.sheet, hd.dong_tieu_de)
    except KeyError as e:
        print(f"❌ CHẶN — {e}")
        return 2

    kq = kiem_tra(hd, tieu_de, dong, ten_file=str(a.file))
    print(in_bao_cao(kq, chi_tiet=a.chi_tiet))

    if a.json and kq.dat:
        a.json.parent.mkdir(parents=True, exist_ok=True)
        a.json.write_text(json.dumps(kq.ban_ghi, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"Đã ghi {kq.so_dong_nhan} bản ghi: {a.json}")

    return 0 if kq.dat else 2


if __name__ == "__main__":
    sys.exit(main())
