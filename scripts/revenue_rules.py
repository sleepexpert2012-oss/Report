"""Canonical Shopee sales metrics used by every dashboard surface.

Revenue is after tax and seller-funded discounts. Orders that are not cancelled
are recognised immediately (including processing/in-transit orders); completed
returns reduce revenue only when Shopee supplies an actual returned quantity.
"""

from __future__ import annotations

import copy
import re
from collections import defaultdict
from typing import Any


_CANCELLED = re.compile(r"cancel|hủy|huỷ", re.IGNORECASE)


def number(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def is_cancelled(status: Any) -> bool:
    return bool(_CANCELLED.search(str(status or "").strip()))


def canonicalize_sales_rows(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """Return engine-ready rows and compact canonical line metrics.

    Seller-funded discount is an order-level field repeated on every API line.
    It is read once per order, clamped to order GMV, then allocated to lines by
    their share of order GMV. This guarantees that SKU totals reconcile exactly
    to the order total without double counting the discount.
    """

    orders: dict[str, dict] = {}
    for index, row in enumerate(rows):
        order_id = str(row.get("ma_don_hang") or f"__missing__{index}").strip()
        order = orders.setdefault(
            order_id,
            {
                "rows": [],
                "gmv": 0.0,
                "discount": None,
                "cancelled": False,
            },
        )
        line_gmv = max(0.0, number(row.get("tong_gia_ban_san_pham")))
        order["rows"].append((index, row, line_gmv))
        order["gmv"] += line_gmv
        order["cancelled"] = order["cancelled"] or is_cancelled(
            row.get("trang_thai_don_hang")
        )
        raw_discount = row.get("tong_so_tien_duoc_nguoi_ban_tro_gia")
        if order["discount"] is None and raw_discount not in (None, ""):
            order["discount"] = max(0.0, number(raw_discount))

    transformed = copy.deepcopy(rows)
    canonical: list[dict] = []
    for order_id, order in orders.items():
        order_gmv = order["gmv"]
        seller_discount = min(order_gmv, number(order["discount"]))
        allocated = 0.0
        line_count = len(order["rows"])

        for position, (index, row, line_gmv) in enumerate(order["rows"]):
            if position == line_count - 1:
                line_discount = seller_discount - allocated
            else:
                line_discount = seller_discount * line_gmv / order_gmv if order_gmv else 0.0
                allocated += line_discount

            qty = max(0.0, number(row.get("so_luong")))
            returned_qty = min(qty, max(0.0, number(row.get("so_luong_san_pham_duoc_hoan_tra"))))
            net_qty = max(0.0, qty - returned_qty)
            keep_ratio = net_qty / qty if qty else 0.0
            before_return = max(0.0, line_gmv - line_discount)
            revenue = 0.0 if order["cancelled"] else before_return * keep_ratio
            return_value = 0.0 if order["cancelled"] else before_return - revenue

            engine_row = transformed[index]
            if not order["cancelled"]:
                engine_row["tong_gia_ban_san_pham"] = revenue
                engine_row["so_luong"] = net_qty
                engine_row["so_luong_san_pham_duoc_hoan_tra"] = 0

            canonical.append(
                {
                    "o": order_id,
                    "d": str(row.get("ngay_dat_hang") or "")[:10],
                    "s": str(row.get("sku_phan_loai_hang") or "").strip(),
                    "st": str(row.get("trang_thai_don_hang") or "").strip(),
                    "x": 1 if order["cancelled"] else 0,
                    "q": round(qty, 6),
                    "rq": round(returned_qty, 6),
                    "nq": round(0.0 if order["cancelled"] else net_qty, 6),
                    "g": round(line_gmv, 6),
                    # A cancelled order recognises neither revenue nor seller
                    # discount. Keeping this at zero also makes the P&L bridge
                    # GMV - cancelled GMV - seller discount - returns reconcile.
                    "sd": round(0.0 if order["cancelled"] else line_discount, 6),
                    "rv": round(return_value, 6),
                    "r": round(revenue, 6),
                }
            )

    return transformed, canonical


def canonical_daily(canonical_rows: list[dict]) -> dict[str, list[float]]:
    """Daily [gross GMV, net revenue, recognised order count]."""

    daily: dict[str, dict] = defaultdict(lambda: {"gmv": 0.0, "revenue": 0.0, "orders": set()})
    for row in canonical_rows:
        day = row["d"]
        if not day:
            continue
        daily[day]["gmv"] += row["g"]
        daily[day]["revenue"] += row["r"]
        if row["r"] > 0:
            daily[day]["orders"].add(row["o"])
    return {
        day.replace("-", "."): [
            round(value["gmv"] / 1_000_000, 3),
            round(value["revenue"] / 1_000_000, 3),
            len(value["orders"]),
        ]
        for day, value in sorted(daily.items())
    }


def canonical_totals(canonical_rows: list[dict]) -> dict[str, float]:
    return {
        "gmv": round(sum(row["g"] for row in canonical_rows), 6),
        "seller_discount": round(sum(row["sd"] for row in canonical_rows if not row["x"]), 6),
        "cancel_gmv": round(sum(row["g"] for row in canonical_rows if row["x"]), 6),
        "return_value": round(sum(row["rv"] for row in canonical_rows), 6),
        "revenue": round(sum(row["r"] for row in canonical_rows), 6),
        "net_units": round(sum(row["nq"] for row in canonical_rows), 6),
    }
