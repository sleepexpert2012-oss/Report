import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const PARTNER_ID = Number(Deno.env.get("SHOPEE_ADS_PARTNER_ID"));
const PARTNER_KEY = (Deno.env.get("SHOPEE_ADS_PARTNER_KEY") || "").trim();
const HOST = (Deno.env.get("SHOPEE_HOST") || "https://partner.shopeemobile.com").trim();
const START = (Deno.env.get("SHOPEE_START_DATE") || "2025-01-01").trim();
const sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const BUDGET = 110000;
async function hmac(b) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(PARTNER_KEY), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(b));
  return [
    ...new Uint8Array(s)
  ].map((x)=>x.toString(16).padStart(2, "0")).join("");
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
  if (row.expire_at && new Date(row.expire_at).getTime() - Date.now() > 6e5) return row;
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
  if (!j.access_token) throw new Error(JSON.stringify(j));
  const u = {
    shop_id: row.shop_id,
    access_token: j.access_token,
    refresh_token: j.refresh_token || row.refresh_token,
    expire_at: new Date((ts + (j.expire_in || 14400)) * 1000).toISOString(),
    updated_at: new Date().toISOString()
  };
  await sb.from("shopee_ads_token").upsert(u);
  return u;
}
function dmy(d) {
  const p = (n)=>String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}
function page(msg, refresh) {
  return new Response(`<html><head>${refresh ? '<meta http-equiv="refresh" content="2">' : ''}</head><body style="font-family:sans-serif;padding:30px"><h3>Dong bo Ads Shopee</h3><p>${msg}</p><p>${refresh ? "Dang chay tiep... GIU TAB MO." : "<b>HOAN TAT!</b>"}</p></body></html>`, {
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}
async function getCampaigns(shopId, token) {
  const ids = [];
  let offset = 0;
  for(let k = 0; k < 40; k++){
    const u = await shopUrl("/api/v2/ads/get_product_level_campaign_id_list", shopId, token, {
      offset,
      limit: 100
    });
    const j = await (await fetch(u)).json();
    const cl = j?.response?.campaign_list || [];
    cl.forEach((c)=>ids.push(c.campaign_id));
    if (!j?.response?.has_next_page || !cl.length) break;
    offset += cl.length;
  }
  return ids;
}
async function getSettings(shopId, token, ids) {
  const map = {};
  for(let i = 0; i < ids.length; i += 50){
    const u = await shopUrl("/api/v2/ads/get_product_level_campaign_setting_info", shopId, token, {
      campaign_id_list: ids.slice(i, i + 50).join(","),
      info_type_list: "1"
    });
    const j = await (await fetch(u)).json();
    (j?.response?.campaign_list || []).forEach((c)=>{
      const ci = c.common_info || {};
      const it = ci.item_id_list || [];
      map[c.campaign_id] = {
        item: it.length === 1 ? String(it[0]) : "-",
        name: ci.ad_name || ""
      };
    });
  }
  return map;
}
Deno.serve(async ()=>{
  const t0 = Date.now();
  try {
    const { data: toks } = await sb.from("shopee_ads_token").select("*");
    if (!toks?.length) return page("Chua uy quyen ads", false);
    const tok = await refreshIfNeeded(toks[0]);
    const shopId = tok.shop_id, token = tok.access_token;
    let { data: st } = await sb.from("shopee_ads_state").select("*").eq("shop_id", shopId).maybeSingle();
    const now = Math.floor(Date.now() / 1000);
    if (!st) {
      await sb.from("ads_fact").delete().gte("_id", 0);
      st = {
        shop_id: shopId,
        next_from: Math.floor(new Date(START + "T00:00:00+07:00").getTime() / 1000),
        done: false
      };
      await sb.from("shopee_ads_state").upsert(st);
    }
    const ids = await getCampaigns(shopId, token);
    const smap = await getSettings(shopId, token, ids);
    let from = st.done ? Math.floor(new Date(new Date().getUTCFullYear() + "-" + String(new Date().getUTCMonth() + 1).padStart(2, "0") + "-01T00:00:00Z").getTime() / 1000) : st.next_from;
    if (st.done) {
      const d = new Date();
      await sb.from("ads_fact").delete().eq("nam", String(d.getUTCFullYear())).eq("thang", String(d.getUTCMonth() + 1).padStart(2, "0"));
    }
    let added = 0, lastTo = "";
    while(from < now && Date.now() - t0 < BUDGET){
      const to = Math.min(from + 15 * 24 * 3600 - 60, now);
      const sd = dmy(new Date(from * 1000)), ed = dmy(new Date(to * 1000));
      const rows = [];
      for(let i = 0; i < ids.length && Date.now() - t0 < BUDGET; i += 30){
        const u = await shopUrl("/api/v2/ads/get_product_campaign_daily_performance", shopId, token, {
          campaign_id_list: ids.slice(i, i + 30).join(","),
          start_date: sd,
          end_date: ed
        });
        const j = await (await fetch(u)).json();
        for (const c of j?.response?.campaign_list || []){
          const m = smap[c.campaign_id] || {
            item: "-",
            name: c.ad_name || ""
          };
          for (const d of c.metrics_list || []){
            if (!(d.impression > 0 || d.expense > 0)) continue;
            const [dd, mm, yy] = String(d.date).split("-");
            rows.push({
              ngay: dd,
              thang: mm,
              nam: yy,
              ten_dich_vu_hien_thi: m.name || c.ad_name || "",
              ma_san_pham: m.item,
              so_luot_xem: d.impression,
              so_luot_click: d.clicks,
              luot_chuyen_doi: d.broad_order,
              luot_chuyen_doi_truc_tiep: d.direct_order,
              san_pham_da_ban: d.broad_order,
              san_pham_da_ban_truc_tiep: d.direct_order,
              doanh_so: d.broad_gmv,
              doanh_so_truc_tiep: d.direct_gmv,
              chi_phi: d.expense,
              roas: d.broad_roi
            });
          }
        }
      }
      for(let i = 0; i < rows.length; i += 500){
        const { error } = await sb.from("ads_fact").insert(rows.slice(i, i + 500).map((r)=>{
          const o = {};
          for(const k in r)o[k] = r[k] == null ? null : String(r[k]);
          return o;
        }));
        if (error) throw new Error(error.message);
      }
      added += rows.length;

      // ---- ĐỐI SOÁT tổng shop: get_all_cpc_ads_daily_performance cho đúng cửa sổ [sd,ed] ----
      // API campaign SẢN PHẨM ở trên có thể thiếu (SP mới / GMS / CPC cấp shop...). API này trả
      // tổng chi phí + doanh số cấp TOÀN SHOP (khớp app seller). Ta ghi 1 dòng/ngày = phần CHÊNH
      // (tổng shop − tổng sản phẩm) để ads_fact khớp tổng thật; dashboard xếp vào "Chưa gắn ngành".
      const prodByDay: Record<string, any> = {};
      for (const r of rows){
        const dk = `${r.ngay}-${r.thang}-${r.nam}`;
        const a = prodByDay[dk] || (prodByDay[dk] = { exp: 0, gmv: 0, dgmv: 0, ord: 0, dord: 0, clk: 0, imp: 0 });
        a.exp += +r.chi_phi || 0; a.gmv += +r.doanh_so || 0; a.dgmv += +r.doanh_so_truc_tiep || 0;
        a.ord += +r.luot_chuyen_doi || 0; a.dord += +r.luot_chuyen_doi_truc_tiep || 0;
        a.clk += +r.so_luot_click || 0; a.imp += +r.so_luot_xem || 0;
      }
      const cu = await shopUrl("/api/v2/ads/get_all_cpc_ads_daily_performance", shopId, token, { start_date: sd, end_date: ed });
      const cj = await (await fetch(cu)).json();
      const recon = [];
      for (const d of (cj?.response || [])){
        const dk = String(d.date);                       // DD-MM-YYYY
        const [dd, mm, yy] = dk.split("-");
        const p = prodByDay[dk] || { exp: 0, gmv: 0, dgmv: 0, ord: 0, dord: 0, clk: 0, imp: 0 };
        const dExp = Math.max(0, (d.expense || 0) - p.exp);
        const dGmv = Math.max(0, (d.broad_gmv || 0) - p.gmv);
        const dGmvD = Math.max(0, (d.direct_gmv || 0) - p.dgmv);
        const dOrd = Math.max(0, (d.broad_order || 0) - p.ord);
        const dOrdD = Math.max(0, (d.direct_order || 0) - p.dord);
        const dClk = Math.max(0, (d.clicks || 0) - p.clk);
        const dImp = Math.max(0, (d.impression || 0) - p.imp);
        if (dExp <= 0 && dGmv <= 0) continue;             // ngày này SP đã phủ đủ -> bỏ qua
        recon.push({
          ngay: dd, thang: mm, nam: yy,
          ten_dich_vu_hien_thi: "CPC khác (chưa phân bổ SP)",
          ma_san_pham: "-",
          so_luot_xem: dImp, so_luot_click: dClk,
          luot_chuyen_doi: dOrd, luot_chuyen_doi_truc_tiep: dOrdD,
          san_pham_da_ban: dOrd, san_pham_da_ban_truc_tiep: dOrdD,
          doanh_so: dGmv, doanh_so_truc_tiep: dGmvD,
          chi_phi: dExp, roas: dExp > 0 ? +(dGmv / dExp).toFixed(2) : 0
        });
      }
      for(let i = 0; i < recon.length; i += 500){
        const { error } = await sb.from("ads_fact").insert(recon.slice(i, i + 500).map((r)=>{
          const o: any = {};
          for(const k in r)o[k] = r[k] == null ? null : String(r[k]);
          return o;
        }));
        if (error) throw new Error("recon: " + error.message);
      }
      added += recon.length;
      lastTo = ed;
      from = to + 60;
      if (!st.done) await sb.from("shopee_ads_state").upsert({
        shop_id: shopId,
        next_from: from,
        done: from >= now,
        updated_at: new Date().toISOString()
      });
    }
    return page(`Ads toi ${lastTo} · them ${added} dong.`, !(st.done || from >= now));
  } catch (e) {
    return page("Loi: " + String(e?.message || e), false);
  }
});
