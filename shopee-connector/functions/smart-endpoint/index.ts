import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const PARTNER_ID = Number(Deno.env.get("SHOPEE_ADS_PARTNER_ID"));
const PARTNER_KEY = (Deno.env.get("SHOPEE_ADS_PARTNER_KEY") || "").trim();
const HOST = (Deno.env.get("SHOPEE_HOST") || "https://partner.shopeemobile.com").trim();
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
  const p = "/api/v2/auth/access_token/get";
  const ts = Math.floor(Date.now() / 1000);
  const sign = await hmac(`${PARTNER_ID}${p}${ts}`);
  const r = await fetch(`${HOST}${p}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}`, {
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
function json(o, s = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status: s,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
Deno.serve(async ()=>{
  const t0 = Date.now();
  try {
    const { data: toks } = await sb.from("shopee_ads_token").select("*");
    if (!toks?.length) return json({
      ok: false,
      message: "Chua uy quyen ads"
    }, 400);
    const tok = await refreshIfNeeded(toks[0]);
    const shopId = tok.shop_id, token = tok.access_token;
    const ids = await getCampaigns(shopId, token);
    const rows = [];
    const items = new Set();
    for(let i = 0; i < ids.length; i += 50){
      const u = await shopUrl("/api/v2/ads/get_product_level_campaign_setting_info", shopId, token, {
        campaign_id_list: ids.slice(i, i + 50).join(","),
        info_type_list: "1,2"
      });
      const j = await (await fetch(u)).json();
      for (const c of j?.response?.campaign_list || []){
        const ci = c.common_info || {};
        const item = (ci.item_id_list || [])[0];
        if (item) items.add(String(item));
        for (const kw of c.manual_bidding_info?.selected_keywords || []){
          rows.push({
            campaign_id: c.campaign_id,
            campaign_name: ci.ad_name || "",
            item_id: item ? String(item) : "",
            keyword: kw.keyword,
            match_type: kw.match_type,
            status: kw.status,
            bid_price: kw.bid_price_per_click,
            search_volume: null,
            quality_score: null
          });
        }
      }
    }
    const sv = {};
    for (const it of [
      ...items
    ]){
      if (Date.now() - t0 > BUDGET) break;
      try {
        const u = await shopUrl("/api/v2/ads/get_recommended_keyword_list", shopId, token, {
          item_id: it
        });
        const j = await (await fetch(u)).json();
        (j?.response?.suggested_keyword_list || []).forEach((k)=>{
          sv[it + "|" + k.keyword] = {
            s: k.search_volume,
            q: k.quality_score
          };
        });
      } catch (e) {}
    }
    rows.forEach((r)=>{
      const m = sv[r.item_id + "|" + r.keyword];
      if (m) {
        r.search_volume = m.s;
        r.quality_score = m.q;
      }
    });
    await sb.from("ads_keyword").delete().gte("_id", 0);
    for(let i = 0; i < rows.length; i += 500){
      const { error } = await sb.from("ads_keyword").insert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    return json({
      ok: true,
      keywords: rows.length,
      items: items.size
    });
  } catch (e) {
    return json({
      ok: false,
      message: String(e?.message || e)
    }, 500);
  }
});
