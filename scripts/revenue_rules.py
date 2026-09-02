"""Canonical Shopee sales metrics used by every dashboard surface.

Shopee amounts are treated as VAT-inclusive commercial values. Accounting
revenue uses the project-wide default 8% output VAT rate; COGS uses deductible-
VAT-exclusive unit cost. Orders that are not cancelled are recognised
immediately (including processing/in-transit orders); completed returns reduce
revenue only when Shopee supplies an actual returned quantity.
"""

from __future__ import annotations

import copy
import re
from collections import defaultdict
from typing import Any


_CANCELLED = re.compile(r"cancel|hủy|huỷ", re.IGNORECASE)
OUTPUT_VAT_RATE = 0.08
OUTPUT_VAT_FACTOR = 1.0 + OUTPUT_VAT_RATE


def number(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def is_cancelled(status: Any) -> bool:
    return bool(_CANCELLED.search(str(status or "").strip()))


def canonical_unit_cost(row: dict) -> float:
    """Return the single COGS basis used throughout the application.

    Unit Cost (VND) excludes deductible input VAT and is authoritative for both
    inventory valuation and COGS. Giá vốn (+VAT) is only a last-resort fallback;
    when used, remove the project's default 8% VAT so the accounting basis does
    not silently mix VAT-inclusive revenue/cost with VAT-exclusive values.
    """

    cost_without_vat = number(row.get("unit_cost_vnd"))
    if cost_without_vat > 0:
        return cost_without_vat
    cost_with_vat = number(row.get("gia_von_vat"))
    return cost_with_vat / OUTPUT_VAT_FACTOR if cost_with_vat > 0 else 0.0


def canonicalize_sales_rows(
    rows: list[dict],
    returns: dict[str, dict] | None = None,
) -> tuple[list[dict], list[dict]]:
    """Return engine-ready rows and compact canonical line metrics.

    Seller-funded discount is an order-level field repeated on every API line.
    It is read once per order, clamped to order GMV, then allocated to lines by
    their share of order GMV. This guarantees that SKU totals reconcile exactly
    to the order total without double counting the discount.

    ``returns`` injects settled returns fetched from Shopee's Returns API
    (``returns.get_return_list``), keyed by order id::

        {order_sn: {"refund": <VAT-inclusive money>, "qty": {variation_sku: n}}}

    Omit it and behaviour is byte-identical to before: returns are then read
    from the ``so_luong_san_pham_duoc_hoan_tra`` column, which Shopee's order
    export leaves at 0, so nothing is deducted. That keeps the legacy dashboard
    unchanged while the v2 pipeline feeds real return data in.

    When supplied, the two sides of a return are deducted on different bases,
    because they answer different questions:

    * revenue falls by ``refund`` — the money Shopee actually clawed back,
      allocated across lines by GMV share so SKU totals still reconcile;
    * quantity and therefore COGS fall by the returned ``qty``, because those
      units physically came back and must stop carrying cost.

    Mixing the two — scaling revenue by a quantity ratio, or reversing COGS by
    a money ratio — is what makes gross margin drift.
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

        # Settled return for this order, if the caller supplied one. Refund is an
        # order-level amount, so it is allocated by GMV share exactly like the
        # seller discount. Returned quantity is per SKU and is consumed line by
        # line, so an order carrying the same SKU on two lines cannot reverse the
        # same unit twice.
        settled = (returns or {}).get(order_id)
        refund_total = min(order_gmv, max(0.0, number(settled.get("refund")))) if settled else 0.0
        refund_allocated = 0.0
        qty_left = {k: max(0.0, number(v)) for k, v in (settled or {}).get("qty", {}).items()}

        for position, (index, row, line_gmv) in enumerate(order["rows"]):
            if position == line_count - 1:
                line_discount = seller_discount - allocated
            else:
                line_discount = seller_discount * line_gmv / order_gmv if order_gmv else 0.0
                allocated += line_discount

            qty = max(0.0, number(row.get("so_luong")))
            if settled is None:
                returned_qty = min(qty, max(0.0, number(row.get("so_luong_san_pham_duoc_hoan_tra"))))
            else:
                sku = str(row.get("sku_phan_loai_hang") or "").strip()
                take = min(qty, qty_left.get(sku, 0.0))
                returned_qty = take
                if take:
                    qty_left[sku] -= take
            net_qty = max(0.0, qty - returned_qty)
            keep_ratio = net_qty / qty if qty else 0.0
            before_return = max(0.0, line_gmv - line_discount)

            if settled is None:
                # Legacy basis: revenue scales with the share of units kept.
                revenue_after_tax = 0.0 if order["cancelled"] else before_return * keep_ratio
                return_after_tax = 0.0 if order["cancelled"] else before_return - revenue_after_tax
            else:
                if position == line_count - 1:
                    line_refund = refund_total - refund_allocated
                else:
                    line_refund = refund_total * line_gmv / order_gmv if order_gmv else 0.0
                    refund_allocated += line_refund
                line_refund = min(before_return, max(0.0, line_refund))
                revenue_after_tax = 0.0 if order["cancelled"] else before_return - line_refund
                return_after_tax = 0.0 if order["cancelled"] else line_refund

            # One accounting basis across Overview, P&L and drill-downs.
            line_gmv_accounting = line_gmv / OUTPUT_VAT_FACTOR
            line_discount_accounting = line_discount / OUTPUT_VAT_FACTOR
            return_value = return_after_tax / OUTPUT_VAT_FACTOR
            revenue = revenue_after_tax / OUTPUT_VAT_FACTOR

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
                    "g": round(line_gmv_accounting, 6),
                    "gat": round(line_gmv, 6),
                    # A cancelled order recognises neither revenue nor seller
                    # discount. Keeping this at zero also makes the P&L bridge
                    # GMV - cancelled GMV - seller discount - returns reconcile.
                    "sd": round(0.0 if order["cancelled"] else line_discount_accounting, 6),
                    "sdat": round(0.0 if order["cancelled"] else line_discount, 6),
                    "rv": round(return_value, 6),
                    "rvat": round(return_after_tax, 6),
                    "r": round(revenue, 6),
                    "rat": round(revenue_after_tax, 6),
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
        "gmv_after_tax": round(sum(row["gat"] for row in canonical_rows), 6),
        "seller_discount_after_tax": round(sum(row["sdat"] for row in canonical_rows if not row["x"]), 6),
        "return_value_after_tax": round(sum(row["rvat"] for row in canonical_rows), 6),
        "revenue_after_tax": round(sum(row["rat"] for row in canonical_rows), 6),
        "net_units": round(sum(row["nq"] for row in canonical_rows), 6),
    }
