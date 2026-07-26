import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PARTNER_ID = Number(Deno.env.get("SHOPEE_PARTNER_ID"));
const PARTNER_KEY = (Deno.env.get("SHOPEE_PARTNER_KEY") || "").trim();
const HOST = (Deno.env.get("SHOPEE_HOST") || "https://partner.shopeemobile.com").trim();
const sb = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);
const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "content-type": "application/json; charset=utf-8",
};
async function hmac(base: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(PARTNER_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function shopUrl(path: string, shopId: number, token: string, extra: Record<string, unknown> = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const sign = await hmac(`${PARTNER_ID}${path}${ts}${token}${shopId}`);
  const q = new URLSearchParams({
    partner_id: String(PARTNER_ID), timestamp: String(ts), access_token: token,
    shop_id: String(shopId), sign,
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
  });
  return `${HOST}${path}?${q}`;
}
async function refresh(row: Record<string, unknown>) {
  if (row.expire_at && new Date(String(row.expire_at)).getTime() - Date.now() > 10 * 60 * 1000) return row;
  const path = "/api/v2/auth/access_token/get";
  const ts = Math.floor(Date.now() / 1000);
  const sign = await hmac(`${PARTNER_ID}${path}${ts}`);
  const r = await fetch(`${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: row.refresh_token, shop_id: row.shop_id, partner_id: PARTNER_ID }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`refresh: ${JSON.stringify(j)}`);
  const upd = {
    shop_id: row.shop_id, access_token: j.access_token,
    refresh_token: j.refresh_token || row.refresh_token,
    expire_at: new Date((ts + (j.expire_in || 14400)) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  await sb.from("shopee_token").upsert(upd);
  return upd;
}
async function get(path: string, shopId: number, token: string, params: Record<string, unknown>) {
  const url = await shopUrl(path, shopId, token, params);
  const r = await fetch(url);
  return await r.json();
}
const result = (j: Record<string, unknown>) => ({
  ok: !j.error, error: j.error || "", message: j.message || "",
  request_id: j.request_id || "", response: j.response || null,
});
const isoVN = (u: unknown) => {
  const n = Number(u);
  if (!n) return "";
  return new Date((n + 7 * 3600) * 1000).toISOString().replace("T", " ").slice(0, 16);
};
const parseDate = (v: unknown) => {
  const s = String(v || "");
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 1000;
  return 0;
};
async function concurrent<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let at = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (at < items.length) {
      const item = items[at++];
      await fn(item);
    }
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mode = body.mode || "probe";
    const { data: tokenRows } = await sb.from("shopee_token").select("*").limit(1);
    if (!tokenRows?.length) throw new Error("Chưa có shop token");
    const tok = await refresh(tokenRows[0]);
    const shopId = Number(tok.shop_id), token = String(tok.access_token);
    const now = Math.floor(Date.now() / 1000);
    const orders: Record<string, unknown>[] = [];
    for (let from = 0;; from += 1000) {
      const { data, error } = await sb.from("sales_fact")
        .select("ma_don_hang,trang_thai_don_hang,ngay_dat_hang")
        .not("ma_don_hang", "is", null).range(from, from + 999);
      if (error) throw new Error(`sales_fact: ${error.message}`);
      orders.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const unique = [...new Map(orders.map((x) => [x.ma_don_hang, x])).values()];
    const active = unique.filter((x) => !/hủy|huỷ|cancel/i.test(String(x.trang_thai_don_hang)));
    const orderSn = String((active[0] || unique[0] || {}).ma_don_hang || "");
    if (!orderSn) throw new Error("Không tìm thấy order_sn để kiểm tra");

    if (mode === "address_probe") {
      const detail = await get("/api/v2/order/get_order_detail", shopId, token, {
        order_sn_list: orderSn,
        response_optional_fields: "recipient_address",
      });
      const address = detail.response?.order_list?.[0]?.recipient_address || {};
      return new Response(JSON.stringify({
        ok: !detail.error,
        error: detail.error || "",
        message: detail.message || "",
        address_keys: Object.keys(address),
        province: address.state || address.region || address.city || "",
      }), { headers });
    }

    if (mode === "sync") {
      const cutoff = now - Number(body.days || 120) * 86400;
      const work = unique.filter((x) => parseDate(x.ngay_dat_hang) >= cutoff);
      let paymentOk = 0, logisticsOk = 0, paymentErrors = 0, logisticsErrors = 0;
      for (let i = 0; i < work.length; i += 50) {
        const batch = work.slice(i, i + 50).map((x) => String(x.ma_don_hang));
        const detail = await get("/api/v2/order/get_order_detail", shopId, token, {
          order_sn_list: batch.join(","),
          response_optional_fields: "shipping_carrier,package_list,order_status,recipient_address",
        });
        for (const order of detail.response?.order_list || []) {
          const pkg = order.package_list?.[0] || {};
          const carrier = order.shipping_carrier || pkg.shipping_carrier || "";
          const tracking = pkg.tracking_number || "";
          const province = order.recipient_address?.state ||
            order.recipient_address?.region ||
            order.recipient_address?.city || "";
          const upd: Record<string, string> = {};
          if (carrier) upd.don_vi_van_chuyen = String(carrier);
          if (tracking) upd.ma_van_don = String(tracking);
          if (province) upd.tinh_thanh_pho = String(province);
          if (Object.keys(upd).length) await sb.from("sales_fact").update(upd).eq("ma_don_hang", order.order_sn);
        }
      }
      await concurrent(work, 6, async (order) => {
        const sn = String(order.ma_don_hang);
        const [pay, logi] = await Promise.all([
          get("/api/v2/payment/get_escrow_detail", shopId, token, { order_sn: sn }),
          get("/api/v2/logistics/get_tracking_info", shopId, token, { order_sn: sn }),
        ]);
        const update: Record<string, string> = {};
        if (!pay.error && pay.response?.order_income) {
          const x = pay.response.order_income;
          update.phi_co_dinh = String(x.commission_fee || 0);
          update.phi_dich_vu = String((x.service_fee || 0) + (x.campaign_fee || 0));
          update.phi_thanh_toan = String((x.seller_transaction_fee || 0) + (x.credit_card_transaction_fee || 0));
          update.tien_ky_quy = String(x.escrow_amount_after_adjustment ?? x.escrow_amount ?? 0);
          update.tong_so_tien_nguoi_mua_thanh_toan = String(x.buyer_total_amount || 0);
          update.phuong_thuc_thanh_toan = String(x.buyer_payment_method || "");
          paymentOk++;
        } else paymentErrors++;
        if (!logi.error && logi.response) {
          const events = (logi.response.tracking_info || []).slice().sort((a, b) => a.update_time - b.update_time);
          const shipped = events.find((e) => /ship|pickup|picked|dropoff|in_transit/i.test(`${e.logistics_status} ${e.description}`));
          const done = [...events].reverse().find((e) => /deliver|completed/i.test(`${e.logistics_status} ${e.description}`));
          if (shipped) update.ngay_xuat_hang = isoVN(shipped.update_time);
          if (done) update.thoi_gian_hoan_thanh_don_hang = isoVN(done.update_time);
          logisticsOk++;
        } else logisticsErrors++;
        if (Object.keys(update).length) await sb.from("sales_fact").update(update).eq("ma_don_hang", sn);
      });

      const returnRows: Record<string, unknown>[] = [];
      let to = now;
      while (to > cutoff) {
        const from = Math.max(cutoff, to - 14 * 86400);
        let page = 1, more = true;
        while (more) {
          const j = await get("/api/v2/returns/get_return_list", shopId, token, {
            page_no: page, page_size: 50, create_time_from: from, create_time_to: to,
          });
          if (j.error) throw new Error(`returns: ${j.error} ${j.message || ""}`);
          const list = j.response?.return || [];
          returnRows.push(...list);
          more = Boolean(j.response?.more);
          page++;
        }
        to = from - 1;
      }
      for (const ret of returnRows) {
        const sn = String(ret.order_sn || "");
        if (!sn) continue;
        const qty = (ret.item || ret.item_list || []).reduce((s: number, x: Record<string, unknown>) =>
          s + Number(x.refund_quantity || x.quantity || x.model_quantity_purchased || 0), 0);
        await sb.from("sales_fact").update({
          trang_thai_tra_hang_hoan_tien: String(ret.status || ret.return_status || "Có yêu cầu trả/hoàn"),
          so_luong_san_pham_duoc_hoan_tra: String(qty),
          phi_tra_hang: String(ret.return_shipping_fee || ret.amount || 0),
        }).eq("ma_don_hang", sn);
      }
      return new Response(JSON.stringify({
        ok: true, mode, shop_id: shopId, period_days: Number(body.days || 120),
        orders: work.length, payment_ok: paymentOk, payment_errors: paymentErrors,
        logistics_ok: logisticsOk, logistics_errors: logisticsErrors,
        returns_found: returnRows.length,
      }), { headers });
    }

    const [payment, logistics, returns] = await Promise.all([
      get("/api/v2/payment/get_escrow_detail", shopId, token, { order_sn: orderSn }),
      get("/api/v2/logistics/get_tracking_info", shopId, token, { order_sn: orderSn }),
      get("/api/v2/returns/get_return_list", shopId, token, {
        page_no: 1, page_size: 20, create_time_from: now - 14 * 86400, create_time_to: now,
      }),
    ]);
    return new Response(JSON.stringify({
      ok: true, mode, shop_id: shopId, tested_order_sn: orderSn,
      permissions: {
        payment: result(payment), logistics: result(logistics), returns: result(returns),
      },
    }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500, headers });
  }
});
