import unittest

from revenue_rules import canonical_totals, canonicalize_sales_rows


def row(order, sku, gmv, qty=1, discount=0, status="Đang giao", returned=0):
    return {
        "ma_don_hang": order,
        "ngay_dat_hang": "2026-08-01 10:00:00",
        "sku_phan_loai_hang": sku,
        "tong_gia_ban_san_pham": gmv,
        "so_luong": qty,
        "tong_so_tien_duoc_nguoi_ban_tro_gia": discount,
        "trang_thai_don_hang": status,
        "so_luong_san_pham_duoc_hoan_tra": returned,
    }


class RevenueRulesTest(unittest.TestCase):
    def test_order_discount_is_counted_once_and_allocated(self):
        rows = [row("A", "S1", 600_000, discount=100_000), row("A", "S2", 400_000, discount=100_000)]
        _, canonical = canonicalize_sales_rows(rows)
        self.assertEqual(sum(x["sd"] for x in canonical), 100_000)
        self.assertEqual(sum(x["r"] for x in canonical), 900_000)
        self.assertEqual([x["r"] for x in canonical], [540_000, 360_000])

    def test_processing_and_in_transit_are_recognised(self):
        rows = [row("A", "S1", 250_000, status="Đang xử lý"), row("B", "S2", 350_000, status="Đang giao")]
        _, canonical = canonicalize_sales_rows(rows)
        self.assertEqual(canonical_totals(canonical)["revenue"], 600_000)

    def test_cancelled_order_has_no_revenue_or_discount(self):
        _, canonical = canonicalize_sales_rows([row("A", "S1", 500_000, discount=50_000, status="Đã hủy")])
        self.assertEqual(canonical[0]["r"], 0)
        self.assertEqual(canonical[0]["sd"], 0)
        self.assertEqual(canonical_totals(canonical)["cancel_gmv"], 500_000)

    def test_partial_actual_return_reduces_revenue_and_units(self):
        _, canonical = canonicalize_sales_rows([row("A", "S1", 900_000, qty=3, discount=90_000, returned=1)])
        self.assertEqual(canonical[0]["nq"], 2)
        self.assertEqual(canonical[0]["rv"], 270_000)
        self.assertEqual(canonical[0]["r"], 540_000)

    def test_return_status_without_returned_quantity_does_not_reduce_revenue(self):
        x = row("A", "S1", 500_000)
        x["trang_thai_tra_hang_hoan_tien"] = "Đã Chấp Thuận Yêu Cầu"
        _, canonical = canonicalize_sales_rows([x])
        self.assertEqual(canonical[0]["r"], 500_000)

    def test_kiot_reference_total(self):
        rows = [row("A", "S1", 44_479_078, discount=4_959_000)]
        _, canonical = canonicalize_sales_rows(rows)
        self.assertEqual(canonical_totals(canonical)["revenue"], 39_520_078)


if __name__ == "__main__":
    unittest.main()
