// Supabase Edge Function: shopee-sync
// Kéo đơn hàng Shopee -> ghi vào bảng sales_fact (dashboard tự đọc).
// Chạy tay để test, sau đó đặt LỊCH (cron) chạy mỗi ngày.
//
// Secrets cần: SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY, SHOPEE_HOST,
//              SHOPEE_START_DATE (vd 2025-01-01),  (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY tự có)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PARTNER_ID = Number(Deno.env.get("SHOPEE_PARTNER_ID"));
const PARTNER_KEY = Deno.env.get("SHOPEE_PARTNER_KEY")!;
const HOST = Deno.env.get("SHOPEE_HOST") || "https://partner.shopeemobile.com";
const START = Deno.env.get("SHOPEE_START_DATE") || "2025-01-01";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function hmac(base: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(PARTNER_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}
// ký cho SHOP API: base = partner_id + path + ts + access_token + shop_id
async function shopUrl(path: string, shopId: number, token: string, extra: Record<string, string | number> = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const sign = await hmac(`${PARTNER_ID}${path}${ts}${token}${shopId}`);
  const q = new URLSearchParams({ partner_id: String(PARTNER_ID), timestamp: String(ts), access_token: token, shop_id: String(shopId), sign, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) });
  return `${HOST}${path}?${q}`;
}

async function refreshIfNeeded(row: any) {
  if (row.expire_at && new Date(row.expire_at).getTime() - Date.now() > 10 * 60 * 1000) return row; // còn >10p thì dùng tiếp
  const path = "/api/v2/auth/access_token/get";
  const ts = Math.floor(Date.now() / 1000);
  const sign = await hmac(`${PARTNER_ID}${path}${ts}`);
  const r = await fetch(`${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: row.refresh_token, shop_id: row.shop_id, partner_id: PARTNER_ID }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("refresh token lỗi: " + JSON.stringify(j));
  const upd = { shop_id: row.shop_id, access_token: j.access_token, refresh_token: j.refresh_token || row.refresh_token,
    expire_at: new Date((ts + (j.expire_in || 14400)) * 1000).toISOString(), updated_at: new Date().toISOString() };
  await sb.from("shopee_token").upsert(upd);
  return upd;
}

function isoVN(unix: number) { // unix giây -> 'YYYY-MM-DD HH:MM' (giờ VN +7)
  const d = new Date((unix + 7 * 3600) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

Deno.serve(async () => {
  try {
    const { data: toks } = await sb.from("shopee_token").select("*");
    if (!toks || !toks.length) return json({ ok: false, message: "Chưa có shop nào ủy quyền. Chạy shopee-auth trước." }, 400);

    const rows: any[] = [];
    let totalOrders = 0;

    for (let tok of toks) {
      tok = await refreshIfNeeded(tok);
      const shopId = tok.shop_id, token = tok.access_token;

      // 1) lấy danh sách order_sn theo từng khoảng 15 ngày
      const orderSns: string[] = [];
      let from = Math.floor(new Date(START + "T00:00:00+07:00").getTime() / 1000);
      const now = Math.floor(Date.now() / 1000);
      while (from < now) {
        const to = Math.min(from + 15 * 24 * 3600 - 60, now);
        let cursor = "";
        do {
          const u = await shopUrl("/api/v2/order/get_order_list", shopId, token, {
            time_range_field: "create_time", time_from: from, time_to: to, page_size: 50, cursor,
            response_optional_fields: "order_status",
          });
          const j = await (await fetch(u)).json();
          const list = j?.response?.order_list || [];
          list.forEach((o: any) => orderSns.push(o.order_sn));
          cursor = j?.response?.more ? j.response.next_cursor : "";
        } while (cursor);
        from = to + 60;
      }
      totalOrders += orderSns.length;

      // 2) lấy chi tiết theo lô 50 order
      for (let i = 0; i < orderSns.length; i += 50) {
        const batch = orderSns.slice(i, i + 50);
        const u = await shopUrl("/api/v2/order/get_order_detail", shopId, token, {
          order_sn_list: batch.join(","),
          response_optional_fields: "item_list,order_status,create_time",
        });
        const j = await (await fetch(u)).json();
        const orders = j?.response?.order_list || [];
        for (const o of orders) {
          const status = o.order_status === "CANCELLED" ? "Đã hủy" : "Hoàn thành";
          const ngay = isoVN(o.create_time);
          for (const it of (o.item_list || [])) {
            const qty = it.model_quantity_purchased || 0;
            const price = it.model_discounted_price ?? it.model_original_price ?? 0;
            rows.push({
              ma_don_hang: o.order_sn,
              ngay_dat_hang: ngay,
              trang_thai_don_hang: status,
              san_pham_ban_chay: it.item_name || "",
              sku_san_pham: it.item_sku || "",
              ten_san_pham: it.item_name || "",
              ten_phan_loai_hang: it.model_name || "",
              sku_phan_loai_hang: (it.model_sku || it.item_sku || "").toString(),
              so_luong: qty,
              so_luong_san_pham_duoc_hoan_tra: 0,
              tong_gia_ban_san_pham: Math.round(price * qty),
            });
          }
        }
      }
    }

    // 3) THAY TOÀN BỘ sales_fact bằng dữ liệu mới (đảm bảo dashboard = trạng thái Shopee hiện tại)
    await sb.from("sales_fact").delete().gte("_id", 0);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from("sales_fact").insert(rows.slice(i, i + 500).map(r => {
        const o: any = {}; for (const k in r) o[k] = r[k] === null ? null : String(r[k]); return o;
      }));
      if (error) throw new Error("insert sales_fact: " + error.message);
    }

    await sb.from("shopee_sync_log").insert({ ok: true, orders: totalOrders, rows: rows.length, message: "OK" });
    return json({ ok: true, orders: totalOrders, rows: rows.length });
  } catch (e) {
    await sb.from("shopee_sync_log").insert({ ok: false, orders: 0, rows: 0, message: String(e?.message || e) });
    return json({ ok: false, message: String(e?.message || e) }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
}
