import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "content-type": "application/json; charset=utf-8",
};
const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s) return 0;
  const normalized = s.includes(",") && !s.includes(".")
    ? s.replace(",", ".")
    : s.replace(/,/g, "");
  const n = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const day = (v: unknown) => {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "";
};
const cancelled = (s: unknown) =>
  /cancel|hủy|huỷ/i.test(String(s ?? ""));

async function all(table: string, select = "*") {
  const out: Record<string, unknown>[] = [];
  for (let from = 0;; from += 1000) {
    const { data, error } = await sb.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const [sales, ads, stock, sku, channelFacts] = await Promise.all([
      all("sales_fact",
        "ma_don_hang,ngay_dat_hang,trang_thai_don_hang,ly_do_huy,don_vi_van_chuyen,ngay_xuat_hang,ngay_giao_hang_du_kien,thoi_gian_hoan_thanh_don_hang,trang_thai_tra_hang_hoan_tien,sku_phan_loai_hang,sku_san_pham,ten_san_pham,so_luong,so_luong_san_pham_duoc_hoan_tra,tong_gia_ban_san_pham,phi_co_dinh,phi_dich_vu,phi_thanh_toan,tien_ky_quy,tinh_thanh_pho"),
      all("ads_fact",
        "ngay,thang,nam,ma_san_pham,noi_dung_dich_vu_hien_thi,so_luot_xem,so_luot_click,luot_chuyen_doi,doanh_so,chi_phi"),
      all("tonkho", "sku_khoa,ten_san_pham,ma_kho_khoa,ton_hien_tai,ton_kha_dung"),
      all("sku", "sku,ma_san_pham,nganh_hang,brand,subcategory_name,gia_von_vat,unit_cost_vnd"),
      all("shopee_channel_fact", "source,fact_date,entity_id,dimensions,metrics,updated_at"),
    ]);
    const dates = sales.map((r) => day(r.ngay_dat_hang)).filter(Boolean).sort();
    const maxDate = dates.at(-1) || new Date().toISOString().slice(0, 10);
    const cutoff = new Date(`${maxDate}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 89);
    const cut = cutoff.toISOString().slice(0, 10);
    const recent = sales.filter((r) => day(r.ngay_dat_hang) >= cut);
    const adDate = (r: Record<string, unknown>) =>
      r.nam && r.thang
        ? `${String(r.nam).padStart(4, "0")}-${String(r.thang).padStart(2, "0")}-${String(r.ngay).padStart(2, "0")}`
        : day(r.ngay);
    const recentAds = ads.filter((r) => adDate(r) >= cut);

    const skuMap = new Map(sku.map((r) => [String(r.sku || "").trim(), r]));
    const orders = new Map<string, { cancel: boolean; gmv: number }>();
    const orderOps = new Map<string, {
      fees: number; fixed: number; service: number; payment: number; escrow: number;
      placed: string; shipped: string; completed: string; carrier: string;
    }>();
    let gross = 0, cancelGmv = 0, units = 0, returnedUnits = 0;
    const cancelSku = new Map<string, { name: string; gmv: number; units: number; reason: string }>();
    const soldSku = new Map<string, number>();
    const regions = new Map<string, { province: string; gmv: number; cancelled_gmv: number; units: number; orders: Set<string>; products: Map<string, number> }>();
    const daily = new Map<string, { date: string; gross: number; net: number; cancel: number; orders: Set<string> }>();
    for (const r of recent) {
      const d = day(r.ngay_dat_hang);
      const value = num(r.tong_gia_ban_san_pham);
      const qty = num(r.so_luong);
      const isCancel = cancelled(r.trang_thai_don_hang);
      gross += value;
      units += isCancel ? 0 : qty;
      returnedUnits += num(r.so_luong_san_pham_duoc_hoan_tra);
      const sn = String(r.ma_don_hang || "");
      const oo = orders.get(sn) || { cancel: false, gmv: 0 };
      oo.cancel ||= isCancel;
      oo.gmv += value;
      orders.set(sn, oo);
      if (!orderOps.has(sn)) {
        orderOps.set(sn, {
          fees: num(r.phi_co_dinh) + num(r.phi_dich_vu) + num(r.phi_thanh_toan),
          fixed: num(r.phi_co_dinh), service: num(r.phi_dich_vu),
          payment: num(r.phi_thanh_toan), escrow: num(r.tien_ky_quy),
          placed: String(r.ngay_dat_hang || ""), shipped: String(r.ngay_xuat_hang || ""),
          completed: String(r.thoi_gian_hoan_thanh_don_hang || ""),
          carrier: String(r.don_vi_van_chuyen || "Chưa xác định"),
        });
      }
      const province = String(r.tinh_thanh_pho || "").trim();
      if (province && !/^\*+$/.test(province) && !/masked|ẩn thông tin/i.test(province)) {
        const rx = regions.get(province) || { province, gmv: 0, cancelled_gmv: 0, units: 0, orders: new Set<string>(), products: new Map<string, number>() };
        rx.gmv += value; rx.cancelled_gmv += isCancel ? value : 0; rx.units += isCancel ? 0 : qty; rx.orders.add(sn);
        const pn = String(r.ten_san_pham || r.sku_phan_loai_hang || "Khác");
        if (!isCancel) rx.products.set(pn, (rx.products.get(pn) || 0) + value);
        regions.set(province, rx);
      }
      if (!daily.has(d)) daily.set(d, { date: d, gross: 0, net: 0, cancel: 0, orders: new Set() });
      const dd = daily.get(d)!;
      dd.gross += value; dd.orders.add(sn);
      if (isCancel) {
        cancelGmv += value; dd.cancel += value;
        const code = String(r.sku_phan_loai_hang || r.sku_san_pham || "Không mã");
        const x = cancelSku.get(code) || {
          name: String(r.ten_san_pham || code), gmv: 0, units: 0,
          reason: String(r.ly_do_huy || "Chưa có lý do từ API"),
        };
        x.gmv += value; x.units += qty; cancelSku.set(code, x);
      } else {
        dd.net += value;
        const code = String(r.sku_phan_loai_hang || r.sku_san_pham || "");
        soldSku.set(code, (soldSku.get(code) || 0) + qty);
      }
    }
    const cancelledOrders = [...orders.values()].filter((x) => x.cancel).length;

    let adSpend = 0, adGmv = 0, clicks = 0, impressions = 0, conversions = 0;
    const adProducts = new Map<string, { id: string; name: string; spend: number; gmv: number; clicks: number }>();
    for (const r of recentAds) {
      const spend = num(r.chi_phi), gmv = num(r.doanh_so);
      adSpend += spend; adGmv += gmv; clicks += num(r.so_luot_click);
      impressions += num(r.so_luot_xem); conversions += num(r.luot_chuyen_doi);
      const id = String(r.ma_san_pham || "Không mã");
      const x = adProducts.get(id) || { id, name: String(r.noi_dung_dich_vu_hien_thi || id), spend: 0, gmv: 0, clicks: 0 };
      x.spend += spend; x.gmv += gmv; x.clicks += num(r.so_luot_click); adProducts.set(id, x);
    }

    const stockBySku = new Map<string, { sku: string; name: string; qty: number; available: number; warehouses: Record<string, number> }>();
    let stockQty = 0, stockValue = 0;
    for (const r of stock) {
      const code = String(r.sku_khoa || "").trim(), qty = num(r.ton_hien_tai);
      const x = stockBySku.get(code) || { sku: code, name: String(r.ten_san_pham || code), qty: 0, available: 0, warehouses: {} };
      x.qty += qty; x.available += num(r.ton_kha_dung);
      x.warehouses[String(r.ma_kho_khoa || "Kho khác")] = qty;
      stockBySku.set(code, x); stockQty += qty;
      const master = skuMap.get(code);
      stockValue += qty * num(master?.unit_cost_vnd || master?.gia_von_vat);
    }

    const issues: Record<string, unknown>[] = [];
    [...cancelSku.entries()].sort((a, b) => b[1].gmv - a[1].gmv).slice(0, 8).forEach(([code, x]) => {
      issues.push({ type: "cancel", severity: x.gmv >= 10_000_000 ? "critical" : "warning",
        title: `Huỷ đơn cao · ${x.name}`, detail: `${x.units} sản phẩm · ${x.reason}`,
        impact: x.gmv, metric: "GMV có nguy cơ mất", entity: code,
        action: "Kiểm tra lý do huỷ, tồn thực và cam kết giao của SKU" });
    });
    [...adProducts.values()].filter((x) => x.spend > 0 && x.gmv <= 0)
      .sort((a, b) => b.spend - a.spend).slice(0, 8).forEach((x) => {
        issues.push({ type: "ads", severity: x.spend >= 1_000_000 ? "critical" : "warning",
          title: `Ads có chi phí nhưng chưa tạo GMV`, detail: `${x.name} · ${x.clicks} click`,
          impact: x.spend, metric: "Chi phí cần rà soát", entity: x.id,
          action: "Giảm bid/tạm dừng và kiểm tra trang sản phẩm, giá, tồn kho" });
      });
    [...stockBySku.values()].forEach((x) => {
      const sold = soldSku.get(x.sku) || 0;
      const months = sold > 0 ? x.qty / (sold / 3) : (x.qty > 0 ? 99 : 0);
      const master = skuMap.get(x.sku);
      const value = x.qty * num(master?.unit_cost_vnd || master?.gia_von_vat);
      if (x.qty > 0 && months >= 6) issues.push({ type: "stock", severity: value >= 20_000_000 ? "critical" : "warning",
        title: `Tồn chậm · ${x.name}`, detail: sold ? `${months.toFixed(1)} tháng tồn · bán ${sold}u/90 ngày` : "Không phát sinh bán trong 90 ngày",
        impact: value, metric: "Vốn tồn cần xử lý", entity: x.sku,
        action: "Ưu tiên campaign xả tồn, combo hoặc điều chuyển kho" });
      if (x.qty <= 0 && sold > 0) issues.push({ type: "stockout", severity: "critical",
        title: `Hết hàng nhưng còn nhu cầu · ${x.name}`, detail: `Đã bán ${sold}u trong 90 ngày`,
        impact: sold, metric: "Nhu cầu 90 ngày", entity: x.sku,
        action: "Tạo đề nghị đặt hàng hoặc bổ sung tồn Shopee" });
    });
    issues.sort((a, b) => (b.severity === "critical" ? 1 : 0) - (a.severity === "critical" ? 1 : 0) || num(b.impact) - num(a.impact));

    const opsOrders = [...orderOps.values()];
    const financeRows = opsOrders.filter((r) => r.fees || r.escrow);
    const logisticsRows = recent.filter((r) => r.don_vi_van_chuyen || r.ngay_xuat_hang || r.thoi_gian_hoan_thanh_don_hang);
    const finance = financeRows.reduce((a, x) => {
      a.fixed_fee += x.fixed; a.service_fee += x.service; a.payment_fee += x.payment;
      a.total_fee += x.fees; a.escrow += x.escrow; return a;
    }, { fixed_fee: 0, service_fee: 0, payment_fee: 0, total_fee: 0, escrow: 0 });
    const toMs = (v: string) => {
      const d = new Date(v.replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? "" : "+07:00"));
      return Number.isFinite(d.getTime()) ? d.getTime() : 0;
    };
    const carriers = new Map<string, { carrier: string; orders: number; prep: number; delivery: number; completed: number }>();
    let prepHours = 0, prepCount = 0, deliveryHours = 0, deliveryCount = 0;
    for (const x of opsOrders) {
      const placed = toMs(x.placed), shipped = toMs(x.shipped), completed = toMs(x.completed);
      const prep = placed && shipped && shipped >= placed ? (shipped - placed) / 3600000 : 0;
      const delivery = shipped && completed && completed >= shipped ? (completed - shipped) / 3600000 : 0;
      if (prep) { prepHours += prep; prepCount++; }
      if (delivery) { deliveryHours += delivery; deliveryCount++; }
      const c = carriers.get(x.carrier) || { carrier: x.carrier, orders: 0, prep: 0, delivery: 0, completed: 0 };
      c.orders++; if (prep) c.prep += prep; if (delivery) { c.delivery += delivery; c.completed++; }
      carriers.set(x.carrier, c);
    }
    const payload = {
      generated_at: new Date().toISOString(), period: { from: cut, to: maxDate, days: 90 },
      sync_status: {
        shopee_data_latest: maxDate,
        shopee_channel_synced_at: channelFacts.map((x) => String(x.updated_at || "")).sort().at(-1) || "",
        app_loaded_at: new Date().toISOString(),
      },
      summary: { gross_gmv: gross, net_gmv: gross - cancelGmv, cancel_gmv: cancelGmv,
        cancel_rate_gmv: gross ? cancelGmv / gross : 0, orders: orders.size, cancelled_orders: cancelledOrders,
        units, returned_units: returnedUnits, ad_spend: adSpend, ad_gmv: adGmv,
        roas: adSpend ? adGmv / adSpend : 0, stock_qty: stockQty, stock_value: stockValue },
      sources: [
        { key: "sale", name: "Data Sale", status: "connected", rows: sales.length, coverage: 1, note: `Dữ liệu đến ${maxDate}` },
        { key: "ads", name: "Data Ads", status: "connected", rows: ads.length, coverage: 1, note: "Hiệu suất quảng cáo" },
        { key: "stock", name: "Tồn kho", status: "connected", rows: stock.length, coverage: 1, note: `${stockQty} unit · ${new Set(stock.map((r) => r.ma_kho_khoa)).size} kho` },
        { key: "payment", name: "Payment / Escrow", status: financeRows.length ? "partial" : "pending", rows: financeRows.length, coverage: recent.length ? financeRows.length / recent.length : 0, note: "Phí sàn & tiền thực nhận" },
        { key: "returns", name: "Returns", status: "connected", rows: returnedUnits, coverage: 1, note: returnedUnits ? "Lý do hoàn & giá trị hoàn" : "Đã kết nối · chưa có yêu cầu hoàn" },
        { key: "logistics", name: "Seller Logistics", status: logisticsRows.length ? "partial" : "pending", rows: logisticsRows.length, coverage: recent.length ? logisticsRows.length / recent.length : 0, note: "SLA giao vận" },
        { key: "affiliate", name: "Affiliate", status: channelFacts.some((x) => x.source === "affiliate") ? "connected" : "pending",
          rows: channelFacts.filter((x) => x.source === "affiliate").length, coverage: channelFacts.some((x) => x.source === "affiliate") ? 1 : 0,
          note: channelFacts.some((x) => x.source === "affiliate") ? "Affiliate API đã đồng bộ" : "Chưa có phản hồi dữ liệu hợp lệ" },
        { key: "video", name: "Shopee Video", status: channelFacts.some((x) => x.source === "video") ? "connected" : "pending",
          rows: channelFacts.filter((x) => x.source === "video").length, coverage: channelFacts.some((x) => x.source === "video") ? 1 : 0,
          note: channelFacts.some((x) => x.source === "video") ? "Video Analytics API đã đồng bộ" : "Chưa có dữ liệu Video" },
      ],
      issues: issues.slice(0, 30),
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).map((x) => ({ ...x, orders: x.orders.size })),
      ads_products: [...adProducts.values()].sort((a, b) => b.spend - a.spend).slice(0, 20).map((x) => ({ ...x, roas: x.spend ? x.gmv / x.spend : 0 })),
      stock_risks: issues.filter((x) => x.type === "stock" || x.type === "stockout").slice(0, 20),
      finance: { ...finance, fee_rate: gross ? finance.total_fee / gross : 0,
        net_after_fees: (gross - cancelGmv) - finance.total_fee, orders_with_payment: financeRows.length },
      logistics: {
        avg_prepare_hours: prepCount ? prepHours / prepCount : 0,
        avg_delivery_hours: deliveryCount ? deliveryHours / deliveryCount : 0,
        orders_with_tracking: new Set(recent.filter((r) => r.ngay_xuat_hang || r.thoi_gian_hoan_thanh_don_hang).map((r) => r.ma_don_hang)).size,
        carriers: [...carriers.values()].map((x) => ({
          carrier: x.carrier, orders: x.orders,
          avg_prepare_hours: x.orders ? x.prep / x.orders : 0,
          avg_delivery_hours: x.completed ? x.delivery / x.completed : 0,
          completed: x.completed,
        })).sort((a, b) => b.orders - a.orders),
      },
      regions: [...regions.values()].map((x) => ({
        province: x.province, gmv: x.gmv, cancelled_gmv: x.cancelled_gmv,
        cancel_rate: x.gmv ? x.cancelled_gmv / x.gmv : 0, units: x.units,
        orders: x.orders.size, aov: x.orders.size ? (x.gmv - x.cancelled_gmv) / x.orders.size : 0,
        top_products: [...x.products.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, gmv]) => ({ name, gmv })),
      })).sort((a, b) => b.gmv - a.gmv),
      channels: {
        affiliate: channelFacts.filter((x) => x.source === "affiliate")
          .sort((a, b) => String(b.fact_date).localeCompare(String(a.fact_date))),
        video: channelFacts.filter((x) => x.source === "video")
          .sort((a, b) => String(b.fact_date).localeCompare(String(a.fact_date))),
        live: channelFacts.filter((x) => x.source === "live")
          .sort((a, b) => String(b.fact_date).localeCompare(String(a.fact_date))),
      },
      data_quality: { sales_rows: sales.length, ads_rows: ads.length, inventory_rows: stock.length,
        finance_coverage: recent.length ? financeRows.length / recent.length : 0,
        logistics_coverage: recent.length ? logisticsRows.length / recent.length : 0 },
    };
    return new Response(JSON.stringify({ ok: true, payload }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500, headers: cors });
  }
});
