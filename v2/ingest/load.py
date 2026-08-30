"""Nạp master từ file Excel vào kho Supabase — theo lô, có đường lùi.

    # xem trước, KHÔNG ghi gì
    python3 -m ingest.load --file "<đường dẫn .xlsx>" --dry-run

    # ghi thật (cần biến môi trường SUPABASE_SERVICE_ROLE_KEY)
    python3 -m ingest.load --file "<đường dẫn .xlsx>" --nguoi-nap "Louis" --kich-hoat

Mỗi lần chạy tạo một LÔ mới, giữ nguyên các lô cũ. App chỉ đọc lô đang được
kích hoạt, nên nạp nhầm thì chỉ cần kích hoạt lại lô trước — không mất gì.

Trước khi ghi, lệnh này luôn in bảng so sánh với lô đang dùng: mã nào thêm,
mã nào mất, trường nào đổi giá trị.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

from .contract import doc_hop_dong
from .excel import doc_sheet
from .report import in_bao_cao
from .validate import KetQua, kiem_tra

SUPA_URL = os.getenv("SUPABASE_URL", "https://jkrczsrhonmqxwzzdgen.supabase.co")
GOC = Path(__file__).resolve().parents[1]

# Những trường mà đổi giá trị thì phải nói ra — số tiền và tham số kế hoạch.
TRUONG_THEO_DOI = ["unit_cost_vnd", "gia_von_vat", "sales_price_vnd", "leadtime",
                   "min_order", "abc_class", "brand", "supplier_code", "nganh_hang"]


def chay_hop_dong(ten_hop_dong: str, file: Path) -> KetQua:
    hd = doc_hop_dong(GOC / "contracts" / ten_hop_dong)
    tieu_de, dong = doc_sheet(file, hd.sheet, hd.dong_tieu_de)
    return kiem_tra(hd, tieu_de, dong, ten_file=file.name)


def bam(file: Path) -> str:
    h = hashlib.sha256()
    with open(file, "rb") as f:
        for khoi in iter(lambda: f.read(1 << 20), b""):
            h.update(khoi)
    return h.hexdigest()


def doc_lo_dang_dung(headers: dict) -> tuple[Optional[dict], List[dict]]:
    """Lô đang được app dùng, kèm toàn bộ SKU của nó. Chưa có bảng thì trả về rỗng."""
    try:
        r = requests.get(f"{SUPA_URL}/rest/v1/v2_nap_lo",
                         headers=headers, params={"select": "*", "dang_dung": "is.true"}, timeout=30)
        if r.status_code == 404:
            return None, []
        r.raise_for_status()
        lo = r.json()
        if not lo:
            return None, []
        s = requests.get(f"{SUPA_URL}/rest/v1/v2_sku_hien_hanh",
                         headers=headers, params={"select": "*", "limit": 5000}, timeout=60)
        s.raise_for_status()
        return lo[0], s.json()
    except requests.HTTPError:
        return None, []


def so_sanh(cu: List[dict], moi: List[dict]) -> Dict[str, Any]:
    a = {r["sku"]: r for r in cu}
    b = {r["sku"]: r for r in moi}
    them = sorted(set(b) - set(a))
    mat = sorted(set(a) - set(b))
    doi: List[dict] = []
    for sku in sorted(set(a) & set(b)):
        for f in TRUONG_THEO_DOI:
            x, y = a[sku].get(f), b[sku].get(f)
            # so bằng chuỗi để tránh 531000 vs 531000.0 bị coi là khác nhau
            if (str(x) if x is not None else "") != (str(y) if y is not None else ""):
                doi.append({"sku": sku, "truong": f, "cu": x, "moi": y})
    return {"them": them, "mat": mat, "doi": doi}


def in_so_sanh(lo_cu: Optional[dict], d: Dict[str, Any], so_moi: int) -> None:
    g = "─" * 72
    print(f"\n{g}\nSO VỚI LÔ ĐANG DÙNG\n{g}")
    if lo_cu is None:
        print("   Kho chưa có lô nào — đây sẽ là lô đầu tiên.")
        print(f"   Sẽ ghi {so_moi} SKU.")
        return
    print(f"   Lô đang dùng : #{lo_cu['id']} · {lo_cu['nguon']} · {lo_cu['tao_luc'][:19].replace('T',' ')}")
    print(f"   SKU thêm mới : {len(d['them'])}" + (f"  {', '.join(d['them'][:8])}" if d["them"] else ""))
    print(f"   SKU biến mất : {len(d['mat'])}" + (f"  {', '.join(d['mat'][:8])}" if d["mat"] else ""))
    print(f"   Trường đổi   : {len(d['doi'])}")
    if d["doi"]:
        theo_truong = Counter(x["truong"] for x in d["doi"])
        for t, n in theo_truong.most_common():
            print(f"      {t:<18} {n} SKU")
        print("   Vài thay đổi cụ thể:")
        for x in d["doi"][:8]:
            print(f"      {x['sku']:<13} {x['truong']:<16} {str(x['cu'])[:18]:>18}  →  {x['moi']}")
        if len(d["doi"]) > 8:
            print(f"      … và {len(d['doi']) - 8} thay đổi nữa")
    if d["mat"]:
        print("\n   ⚠ SKU biến mất khỏi master vẫn có thể đang bán. Kiểm tra trước khi kích hoạt lô này.")


def ghi(headers: dict, bang: str, rows: List[dict]) -> None:
    if not rows:
        return
    for i in range(0, len(rows), 500):
        r = requests.post(f"{SUPA_URL}/rest/v1/{bang}",
                          headers={**headers, "Content-Type": "application/json",
                                   "Prefer": "return=minimal"},
                          json=rows[i:i + 500], timeout=120)
        r.raise_for_status()


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Nạp master vào kho Supabase theo lô")
    p.add_argument("--file", required=True, type=Path)
    p.add_argument("--dry-run", action="store_true", help="chỉ xem trước, không ghi gì")
    p.add_argument("--kich-hoat", action="store_true", help="cho app dùng lô này ngay sau khi ghi")
    p.add_argument("--nguoi-nap", default=os.getenv("USER", "khong-ro"))
    p.add_argument("--ghi-chu", default="")
    a = p.parse_args(argv)

    khoa = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not khoa:
        print("❌ Thiếu SUPABASE_SERVICE_ROLE_KEY (hoặc SUPABASE_ANON_KEY để chỉ đọc).")
        return 2
    headers = {"apikey": khoa, "Authorization": f"Bearer {khoa}"}

    # --- 1. kiểm tra hai sheet ---
    kq_sku = chay_hop_dong("sku-master.yaml", a.file)
    print(in_bao_cao(kq_sku, chi_tiet=6))
    if not kq_sku.dat:
        return 2

    kq_ncc = chay_hop_dong("supplier.yaml", a.file)
    print(in_bao_cao(kq_ncc, chi_tiet=6))
    if not kq_ncc.dat:
        return 2

    sku_rows, ncc_rows = kq_sku.ban_ghi, kq_ncc.ban_ghi

    # --- 2. dựng brand và đếm SKU ---
    dem_brand = Counter(r["brand"] for r in sku_rows if r.get("brand"))
    dem_ncc = Counter(r["supplier_code"] for r in sku_rows if r.get("supplier_code"))

    # --- 3. so với lô đang dùng ---
    lo_cu, sku_cu = doc_lo_dang_dung(headers)
    d = so_sanh(sku_cu, sku_rows)
    in_so_sanh(lo_cu, d, len(sku_rows))

    if a.dry_run:
        print("\n── XEM TRƯỚC, chưa ghi gì lên Supabase ──")
        print(f"   Sẽ tạo 1 lô · {len(sku_rows)} SKU · {len(dem_brand)} brand · {len(ncc_rows)} nhà cung cấp")
        print(f"   Brand: {dict(dem_brand)}")
        return 0

    if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        print("\n❌ Ghi thật cần SUPABASE_SERVICE_ROLE_KEY. Anon key chỉ đọc được.")
        return 2

    # --- 4. tạo lô ---
    r = requests.post(f"{SUPA_URL}/rest/v1/v2_nap_lo",
                      headers={**headers, "Content-Type": "application/json", "Prefer": "return=representation"},
                      json={"nguon": a.file.name, "hop_dong": "sku-master.yaml + supplier.yaml",
                            "bam_file": bam(a.file), "so_dong_doc": kq_sku.tong_dong_doc,
                            "so_dong_nhan": kq_sku.so_dong_nhan, "so_dong_loai": len(kq_sku.dong_bi_loai),
                            "nguoi_nap": a.nguoi_nap, "ghi_chu": a.ghi_chu,
                            "bao_cao": {"sku": {"loai": [x.__dict__ for x in kq_sku.dong_bi_loai],
                                                "vi_pham": [v.__dict__ for v in kq_sku.vi_pham]},
                                        "ncc": {"vi_pham": [v.__dict__ for v in kq_ncc.vi_pham]}}},
                      timeout=60)
    r.raise_for_status()
    lo_id = r.json()[0]["id"]
    print(f"\n✔ Đã tạo lô #{lo_id}")

    ghi(headers, "v2_dim_sku", [{**s, "lo_id": lo_id} for s in sku_rows])
    ghi(headers, "v2_dim_brand", [{"lo_id": lo_id, "brand": b, "so_sku": n} for b, n in dem_brand.items()])
    ghi(headers, "v2_dim_supplier",
        [{**n, "lo_id": lo_id, "so_sku": dem_ncc.get(n["supplier_code"], 0)} for n in ncc_rows])
    print(f"✔ Đã ghi {len(sku_rows)} SKU · {len(dem_brand)} brand · {len(ncc_rows)} nhà cung cấp")

    if a.kich_hoat:
        # tắt lô cũ trước, vì database chỉ cho đúng một lô đang dùng
        requests.patch(f"{SUPA_URL}/rest/v1/v2_nap_lo", headers={**headers, "Content-Type": "application/json"},
                       params={"dang_dung": "is.true"}, json={"dang_dung": False}, timeout=30).raise_for_status()
        requests.patch(f"{SUPA_URL}/rest/v1/v2_nap_lo", headers={**headers, "Content-Type": "application/json"},
                       params={"id": f"eq.{lo_id}"}, json={"dang_dung": True}, timeout=30).raise_for_status()
        print(f"✔ App đang dùng lô #{lo_id}")
    else:
        print(f"○ Lô #{lo_id} đã ghi nhưng CHƯA kích hoạt — app vẫn đọc lô cũ."
              f"\n  Kích hoạt khi sẵn sàng bằng cách chạy lại có thêm --kich-hoat, hoặc đổi cờ dang_dung.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
