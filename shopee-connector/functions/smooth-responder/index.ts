import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const PARTNER_ID = Number(Deno.env.get("SHOPEE_PARTNER_ID"));
const PARTNER_KEY = (Deno.env.get("SHOPEE_PARTNER_KEY") || "").trim();
const HOST = (Deno.env.get("SHOPEE_HOST") || "https://partner.shopeemobile.com").trim();
const START = (Deno.env.get("SHOPEE_START_DATE") || "2025-01-01").trim();
const sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const BUDGET = 110000;
async function hmac(base) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(PARTNER_KEY), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  return [
    ...new Uint8Array(sig)
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
}
async function shopUrl(path, shopId, token, extra = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const sign = await hmac(`${PARTNER_ID}${path}${ts}${token}${shopId}`);
  const q = new URLSearchParams({
    partner_id: String(PARTNER_ID),
    timestamp: String(ts),
    access_token: token,
    shop_id: String(shopId),
    sign,
    ...Object.fromEntries(Object.entries(extra).map(([k, v])=>[
        k,
        String(v)
      ]))
  });
  return `${HOST}${path}?${q}`;
}
async function refreshIfNeeded(row) {
  if (row.expire_at && new Date(row.expire_at).getTime() - Date.now() > 10 * 60 * 1000) return row;
  const path = "/api/v2/auth/access_token/get";
  const ts = Math.floor(Date.now() / 1000);
  const sign = await hmac(`${PARTNER_ID}${path}${ts}`);
  const r = await fetch(`${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      refresh_token: row.refresh_token,
      shop_id: row.shop_id,
      partner_id: PARTNER_ID
    })
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("refresh loi: " + JSON.stringify(j));
  const upd = {
    shop_id: row.shop_id,
    access_token: j.access_token,
    refresh_token: j.refresh_token || row.refresh_token,
    expire_at: new Date((ts + (j.expire_in || 14400)) * 1000).toISOString(),
    updated_at: new Date().toISOString()
  };
  await sb.from("shopee_token").upsert(upd);
  return upd;
}
function isoVN(u) {
  const d = new Date((u + 7 * 3600) * 1000);
  const p = (n)=>String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
function page(msg, refresh) {
  return new Response(`<html><head>${refresh ? '<meta http-equiv="refresh" content="2">' : ''}</head><body style="font-family:sans-serif;padding:30px"><h3>Dong bo don Shopee</h3><p>${msg}</p><p>${refresh ? "Dang chay tiep... GIU TAB NAY MO." : "<b>HOAN TAT!</b> Mo dashboard de xem."}</p></body></html>`, {
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}
Deno.serve(async ()=>{
  const t0 = Date.now();
  try {
    const { data: toks } = await sb.from("shopee_token").select("*");
    if (!toks?.length) return page("Chua co shop uy quyen.", false);
    let addRows = 0, allDone = true, lastTo = "";
    for (let tok of toks){
      tok = await refreshIfNeeded(tok);
      const shopId = tok.shop_id, token = tok.access_token;
      let { data: st } = await sb.from("shopee_sync_state").select("*").eq("shop_id", shopId).maybeSingle();
      const now = Math.floor(Date.now() / 1000);
      if (!st) {
        await sb.from("sales_fact").delete().gte("_id", 0);
        st = {
          shop_id: shopId,
          next_from: Math.floor(new Date(START + "T00:00:00+07:00").getTime() / 1000),
          done: false
        };
        await sb.from("shopee_sync_state").upsert(st);
      }
      let from = st.done ? now - 30 * 24 * 3600 : st.next_from; // xong roi thi chi lam moi 30 ngay gan nhat
      while(from < now && Date.now() - t0 < BUDGET){
        const to = Math.min(from + 15 * 24 * 3600 - 60, now);
        const sns = [];
        let cursor = "";
        do {
          const u = await shopUrl("/api/v2/order/get_order_list", shopId, token, {
            time_range_field: "create_time",
            time_from: from,
            time_to: to,
            page_size: 50,
            cursor,
            response_optional_fields: "order_status"
          });
          const j = await (await fetch(u)).json();
          (j?.response?.order_list || []).forEach((o)=>sns.push(o.order_sn));
          cursor = j?.response?.more ? j.response.next_cursor : "";
        }while (cursor && Date.now() - t0 < BUDGET)
        const rows = [];
        for(let i = 0; i < sns.length; i += 50){
          const u = await shopUrl("/api/v2/order/get_order_detail", shopId, token, {
            order_sn_list: sns.slice(i, i + 50).join(","),
            response_optional_fields: "item_list,order_status,create_time"
          });
          const j = await (await fetch(u)).json();
          for (const o of j?.response?.order_list || []){
            const status = o.order_status === "CANCELLED" ? "Đã hủy" : "Hoàn thành";
            const ngay = isoVN(o.create_time);
            for (const it of o.item_list || []){
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
                sku_phan_loai_hang: String(it.model_sku || it.item_sku || ""),
                so_luong: qty,
                so_luong_san_pham_duoc_hoan_tra: 0,
                tong_gia_ban_san_pham: Math.round(price * qty)
              });
            }
          }
        }
        for(let i = 0; i < sns.length; i += 100)await sb.from("sales_fact").delete().in("ma_don_hang", sns.slice(i, i + 100));
        for(let i = 0; i < rows.length; i += 500){
          const { error } = await sb.from("sales_fact").insert(rows.slice(i, i + 500).map((r)=>{
            const o = {};
            for(const k in r)o[k] = String(r[k]);
            return o;
          }));
          if (error) throw new Error(error.message);
        }
        addRows += rows.length;
        from = to + 60;
        lastTo = new Date(to * 1000).toISOString().slice(0, 10);
        if (!st.done) await sb.from("shopee_sync_state").upsert({
          shop_id: shopId,
          next_from: from,
          done: from >= now,
          updated_at: new Date().toISOString()
        });
      }
      if (!st.done && from < now) allDone = false;
    }
    return page(`Da xu ly toi ${lastTo} · them ${addRows} dong.`, !allDone);
  } catch (e) {
    return page("Loi: " + String(e?.message || e), false);
  }
});
