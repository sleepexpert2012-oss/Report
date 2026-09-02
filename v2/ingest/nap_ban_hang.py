"""Dựng bảng sự kiện bán hàng cho app v2.

    python3 -m ingest.nap_ban_hang --sql output/nap-ban-hang.sql

Đọc `sales_fact` (đơn hàng Shopee thô) → chạy qua `revenue_rules.py` → ghép giá
vốn từ danh mục v2 → sinh câu lệnh nạp vào `v2_fact_sale`.

Điểm mấu chốt: **doanh thu KHÔNG được định nghĩa ở đây**. Nó do
`scripts/revenue_rules.py` quyết định — cùng một module mà app đời trước dùng,
đã có unit test và đã đối chiếu với Kiot. Nhờ vậy app cũ và app mới không thể
ra hai con số khác nhau.

Bảng có cột `channel` ngay từ đầu dù hôm nay chỉ có Shopee. Khi Đại Lý về, chỉ
cần viết thêm một bộ chuyển đổi ghi vào cùng bảng này — không màn hình nào
phải sửa.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import requests

GOC = Path(__file__).resolve().parents[1]
# revenue_rules.py nằm ở pipeline của app cũ. Dùng lại NGUYÊN BẢN, không sao chép:
# sao chép là mở đường cho hai bản trôi khác nhau theo thời gian.
sys.path.insert(0, str(GOC.parent / "scripts"))
from revenue_rules import canonical_unit_cost, canonicalize_sales_rows  # noqa: E402

SUPA = os.getenv("SUPABASE_URL", "https://jkrczsrhonmqxwzzdgen.supabase.co")
KENH = "shopee"

COT = [
    ("channel", "text"), ("stt", "int"), ("order_id", "text"), ("order_date", "date"),
    ("sku", "text"), ("trang_thai", "text"), ("da_huy", "bool"),
    ("qty", "numeric"), ("qty_hoan", "numeric"), ("qty_thuan", "numeric"),
    ("gmv", "numeric"), ("giam_gia", "numeric"), ("gia_tri_hoan", "numeric"),
    ("doanh_thu", "numeric"), ("cogs", "numeric"),
]


def doc_bang(bang: str, chon: str = "*") -> List[Dict[str, Any]]:
    khoa = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not khoa:
        raise SystemExit("Thiếu SUPABASE_ANON_KEY hoặc SUPABASE_SERVICE_ROLE_KEY")
    h = {"apikey": khoa, "Authorization": f"Bearer {khoa}"}
    ra, offset = [], 0
    while True:
        r = requests.get(f"{SUPA}/rest/v1/{bang}",
                         headers=h, params={"select": chon, "limit": 1000, "offset": offset},
                         timeout=90)
        r.raise_for_status()
        trang = r.json()
        ra.extend(trang)
        if len(trang) < 1000:
            return ra
        offset += 1000


TRANG_THAI_TRU = ("ACCEPTED",)
"""Trạng thái yêu cầu trả được tính vào doanh thu. Louis chốt 2/9/2026: chỉ ACCEPTED.

Ba trạng thái còn lại cố ý KHÔNG tính:
  CANCELLED  — yêu cầu BỊ THAY THẾ bởi yêu cầu mới cùng số tiền. Cộng vào là đếm
               trùng: 5/6 đơn có nhiều yêu cầu đều theo mẫu này, cộng thừa 22,6 tr.
  CLOSED     — chưa xác định được nghĩa, chờ đối chiếu.
  PROCESSING — Shopee đã ghi số tiền hoàn nhưng hàng chưa về kho.
"""


def doc_hoan_tra() -> Dict[str, Dict[str, Any]]:
    """Đọc yêu cầu trả hàng đã chốt, dựng bản đồ cho revenue_rules.

    Nguồn DUY NHẤT là hai bảng v2_fact_return(_item), do `returns-sync` kéo từ
    `returns.get_return_list`. KHÔNG suy từ escrow, KHÔNG lấy từ cột Excel
    `so_luong_san_pham_duoc_hoan_tra` — cột đó Shopee xuất ra luôn bằng 0.

    Trả về {order_sn: {"refund": tiền đã VAT, "qty": {sku_phan_loai: số lượng}}}.
    """
    dau = [r for r in doc_bang("v2_fact_return", "return_sn,order_sn,status,refund_amount")
           if r.get("status") in TRANG_THAI_TRU]
    mon = doc_bang("v2_fact_return_item", "return_sn,variation_sku,so_luong")
    theo_sn: Dict[str, list] = {}
    for m in mon:
        theo_sn.setdefault(m["return_sn"], []).append(m)

    ra: Dict[str, Dict[str, Any]] = {}
    for r in dau:
        don = str(r["order_sn"] or "").strip()
        if not don:
            continue
        o = ra.setdefault(don, {"refund": 0.0, "qty": {}})
        o["refund"] += float(r["refund_amount"] or 0)
        for m in theo_sn.get(r["return_sn"], []):
            sku = str(m.get("variation_sku") or "").strip()
            if sku:
                o["qty"][sku] = o["qty"].get(sku, 0.0) + float(m.get("so_luong") or 0)
    return ra


def lit(v: Any, kieu: str) -> str:
    if v is None or v == "":
        return f"null::{kieu}"
    if kieu == "bool":
        return "true" if v else "false"
    if kieu in ("numeric", "int"):
        try:
            return repr(int(v)) if kieu == "int" else repr(round(float(v), 4))
        except (TypeError, ValueError):
            return f"null::{kieu}"
    s = "'" + str(v).replace("'", "''") + "'"
    return s + "::date" if kieu == "date" else s


DDL = """-- Bảng sự kiện bán hàng cho app v2 — CHUNG cho mọi kênh.
-- Sinh tự động bởi v2/ingest/nap_ban_hang.py, đừng sửa tay.
create table if not exists public.v2_fact_sale (
  channel      text    not null,   -- shopee | dai_ly | online | b2b
  stt          int     not null,
  order_id     text    not null,
  order_date   date,
  sku          text,
  trang_thai   text,
  da_huy       boolean not null default false,
  qty          numeric,
  qty_hoan     numeric,
  qty_thuan    numeric,
  gmv          numeric,           -- chưa VAT, đã chia 1,08
  giam_gia     numeric,           -- giảm giá seller, đã phân bổ về dòng
  gia_tri_hoan numeric,
  doanh_thu    numeric,           -- gmv − giảm giá − hoàn, đơn huỷ bằng 0
  cogs         numeric,           -- qty_thuan × giá vốn chuẩn
  primary key (channel, stt)
);
create index if not exists v2_fact_sale_ngay_idx on public.v2_fact_sale (order_date);
create index if not exists v2_fact_sale_sku_idx  on public.v2_fact_sale (sku);

alter table public.v2_fact_sale enable row level security;
drop policy if exists v2_fact_sale_doc on public.v2_fact_sale;
create policy v2_fact_sale_doc on public.v2_fact_sale for select to anon, authenticated using (true);
"""


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--sql", type=Path, default=GOC / "output" / "nap-ban-hang.sql")
    a = p.parse_args()

    print("Đọc sales_fact…", flush=True)
    tho = doc_bang("sales_fact")
    print(f"  {len(tho):,} dòng thô")

    print("Đọc danh mục SKU đang dùng…", flush=True)
    dm = doc_bang("v2_sku_hien_hanh", "sku,unit_cost_vnd,gia_von_vat")
    gia_von = {
        r["sku"]: canonical_unit_cost({"unit_cost_vnd": r.get("unit_cost_vnd"),
                                       "gia_von_vat": r.get("gia_von_vat")})
        for r in dm
    }
    print(f"  {len(gia_von)} SKU · {sum(1 for v in gia_von.values() if v > 0)} mã có giá vốn")

    print("Đọc yêu cầu trả hàng đã chốt…", flush=True)
    hoan = doc_hoan_tra()
    sl_hoan = sum(sum(o["qty"].values()) for o in hoan.values())
    print(f"  {len(hoan)} đơn có hoàn trả · {sl_hoan:,.0f} sản phẩm · "
          f"{sum(o['refund'] for o in hoan.values())/1e6:,.1f} triệu (đã VAT)")

    print("Chạy revenue_rules.py…", flush=True)
    _, canon = canonicalize_sales_rows(tho, returns=hoan)

    thieu_gia = set()
    rows = []
    for i, c in enumerate(canon, start=1):
        sku = c["s"]
        gv = gia_von.get(sku)
        if gv is None and c["nq"] > 0:
            thieu_gia.add(sku)
        rows.append({
            "channel": KENH, "stt": i, "order_id": c["o"], "order_date": c["d"] or None,
            "sku": sku or None, "trang_thai": c["st"], "da_huy": bool(c["x"]),
            "qty": c["q"], "qty_hoan": c["rq"], "qty_thuan": c["nq"],
            "gmv": c["g"], "giam_gia": c["sd"], "gia_tri_hoan": c["rv"],
            "doanh_thu": c["r"], "cogs": c["nq"] * (gv or 0.0),
        })

    dt = sum(r["doanh_thu"] for r in rows)
    cogs = sum(r["cogs"] for r in rows)
    hoan_tt = sum(r["gia_tri_hoan"] for r in rows)
    print(f"\n  GMV        {sum(r['gmv'] for r in rows)/1e6:>12,.1f} triệu")
    print(f"  Hoàn trả   {hoan_tt/1e6:>12,.1f} triệu  (đã trừ khỏi doanh thu)")
    print(f"  Doanh thu  {dt/1e6:>12,.1f} triệu")
    print(f"  Giá vốn    {cogs/1e6:>12,.1f} triệu")
    print(f"  GM         {(dt-cogs)/dt*100:>12,.1f} %")
    if thieu_gia:
        print(f"\n  ⚠ {len(thieu_gia)} mã bán ra KHÔNG có trong danh mục nên giá vốn tính bằng 0:")
        for s in sorted(thieu_gia)[:8]:
            print(f"      {s}")
        print("    → những mã này sẽ hiện trong sổ vấn đề dữ liệu, không bị giấu đi.")

    # Vòng đối chiếu: mã bán ra mà danh mục không có phải hiện lên sổ vấn đề,
    # không được lặng lẽ tính giá vốn bằng 0 rồi thôi như app đời trước.
    treo = {}
    for r in rows:
        if r["sku"] in thieu_gia:
            treo[r["sku"]] = treo.get(r["sku"], 0.0) + r["doanh_thu"]
    dq = "\n".join(
        "insert into public.v2_dq_van_de (loai, khoa, mo_ta, gmv_treo) values "
        f"('sku_ban_ra_thieu_master', {lit(s_, 'text')}, "
        f"{lit('Mã bán ra nhưng không có trong danh mục SKU — giá vốn đang tính bằng 0', 'text')}, "
        f"{lit(round(v, 2), 'numeric')}) "
        "on conflict (loai, khoa) do update set gmv_treo = excluded.gmv_treo, trang_thai = 'mo';"
        for s_, v in sorted(treo.items(), key=lambda kv: -kv[1])
    )

    ten = [c for c, _ in COT]
    vals = ",\n".join("  (" + ", ".join(lit(r[c], k) for c, k in COT) + ")" for r in rows)
    sql = (DDL
           + f"\ndelete from public.v2_fact_sale where channel = '{KENH}';\n\n"
           + f"insert into public.v2_fact_sale ({', '.join(ten)}) values\n{vals};\n\n"
           + dq + "\n\n"
           + "select channel, count(*) as dong, round(sum(doanh_thu)) as doanh_thu,\n"
             "       round(sum(cogs)) as gia_von\n"
             "from public.v2_fact_sale group by channel;\n")
    a.sql.parent.mkdir(parents=True, exist_ok=True)
    a.sql.write_text(sql, encoding="utf-8")
    print(f"\nĐã ghi {len(rows):,} dòng vào {a.sql} ({len(sql):,} ký tự)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
