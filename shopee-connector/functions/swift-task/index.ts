import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const PARTNER_ID = Number(Deno.env.get("SHOPEE_ADS_PARTNER_ID"));
const PARTNER_KEY = (Deno.env.get("SHOPEE_ADS_PARTNER_KEY") || "").trim();
const HOST = (Deno.env.get("SHOPEE_HOST") || "https://partner.shopeemobile.com").trim();
const SELF_URL = (Deno.env.get("ADS_SELF_URL") || "").trim();
const sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
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
Deno.serve(async (req)=>{
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const shopId = url.searchParams.get("shop_id");
  const ts = Math.floor(Date.now() / 1000);
  if (code && shopId) {
    const path = "/api/v2/auth/token/get";
    const sign = await hmac(`${PARTNER_ID}${path}${ts}`);
    const r = await fetch(`${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code,
        shop_id: Number(shopId),
        partner_id: PARTNER_ID
      })
    });
    const j = await r.json();
    if (!j.access_token) return new Response("Loi token: " + JSON.stringify(j), {
      status: 400
    });
    await sb.from("shopee_ads_token").upsert({
      shop_id: Number(shopId),
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expire_at: new Date((ts + (j.expire_in || 14400)) * 1000).toISOString(),
      updated_at: new Date().toISOString()
    });
    return new Response(`OK - Uy quyen ADS thanh cong cho shop ${shopId}.`, {
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }
  const path = "/api/v2/shop/auth_partner";
  const sign = await hmac(`${PARTNER_ID}${path}${ts}`);
  const authUrl = `${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}&redirect=${encodeURIComponent(SELF_URL)}`;
  return Response.redirect(authUrl, 302);
});
