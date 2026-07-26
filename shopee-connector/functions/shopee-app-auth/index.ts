import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HOST = (Deno.env.get("SHOPEE_HOST") || "https://partner.shopeemobile.com").trim();
const OPEN_HOST = "https://open.shopee.com";
const PUBLIC_CALLBACK = (Deno.env.get("SHOPEE_PUBLIC_CALLBACK_BASE") ||
  "https://sleepexpert2012-oss.github.io/Report").replace(/\/+$/, "");
const sb = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);
type AppKey = "affiliate" | "live" | "video";
const configs: Record<AppKey, { id: number; key: string }> = {
  affiliate: {
    id: Number(Deno.env.get("SHOPEE_AFFILIATE_PARTNER_ID")),
    key: (Deno.env.get("SHOPEE_AFFILIATE_PARTNER_KEY") || "").trim(),
  },
  live: {
    id: Number(Deno.env.get("SHOPEE_LIVE_PARTNER_ID")),
    key: (Deno.env.get("SHOPEE_LIVE_PARTNER_KEY") || "").trim(),
  },
  video: {
    id: Number(Deno.env.get("SHOPEE_VIDEO_PARTNER_ID")),
    key: (Deno.env.get("SHOPEE_VIDEO_PARTNER_KEY") || "").trim(),
  },
};
async function sign(key: string, base: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const raw = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(base));
  return [...new Uint8Array(raw)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const text = (message: string, status = 200) =>
  new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const app = url.searchParams.get("app") as AppKey;
  if (!["affiliate", "live", "video"].includes(app)) {
    return text("Thiếu app=affiliate, app=live hoặc app=video.", 400);
  }
  const cfg = configs[app];
  if (!cfg.id || !cfg.key) {
    return text(`App ${app} chưa có Partner ID/Partner Key trong Supabase Secrets.`, 503);
  }
  const ts = Math.floor(Date.now() / 1000);
  const code = url.searchParams.get("code");
  const shopId = Number(url.searchParams.get("shop_id"));
  const isUserApp = app === "live" || app === "video";
  if (code && (isUserApp || shopId)) {
    const path = "/api/v2/auth/token/get";
    const sig = await sign(cfg.key, `${cfg.id}${path}${ts}`);
    const r = await fetch(`${HOST}${path}?partner_id=${cfg.id}&timestamp=${ts}&sign=${sig}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(isUserApp
        ? { code, partner_id: cfg.id }
        : { code, shop_id: shopId, partner_id: cfg.id }),
    });
    const raw = await r.text();
    let j: Record<string, any>;
    try {
      j = JSON.parse(raw);
    } catch {
      return text(`Shopee trả phản hồi không hợp lệ (${r.status}): ${raw.slice(0, 160)}`, 502);
    }
    if (!j.access_token) return text(`Không lấy được token ${app}: ${j.error || j.message || "unknown"}`, 400);
    const resolvedShopId = Number(j.shop_id_list?.[0] || shopId || 0);
    const userId = Number(j.user_id_list?.[0] || j.user_id || 0);
    if (isUserApp && !userId) return text(`Shopee không trả về user_id cho ${app}.`, 400);
    const { error } = await sb.from("shopee_app_token").upsert({
      app_key: app, shop_id: resolvedShopId, user_id: userId || null, access_token: j.access_token,
      refresh_token: j.refresh_token,
      expire_at: new Date((ts + (j.expire_in || 14400)) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) return text(`Không lưu được token ${app}: ${error.message}`, 500);
    return text(`OK - Đã uỷ quyền ${app}${userId ? ` cho user ${userId}` : ` cho shop ${resolvedShopId}`}. Có thể đóng tab này.`);
  }
  const callback = `${PUBLIC_CALLBACK}/shopee-${app}-callback.html`;
  let authUrl: string;
  if (isUserApp) {
    authUrl = `${OPEN_HOST}/auth?partner_id=${cfg.id}&auth_type=seller&redirect_uri=${encodeURIComponent(callback)}&response_type=code`;
  } else {
    const path = "/api/v2/shop/auth_partner";
    const sig = await sign(cfg.key, `${cfg.id}${path}${ts}`);
    authUrl = `${HOST}${path}?partner_id=${cfg.id}&timestamp=${ts}&sign=${sig}&redirect=${encodeURIComponent(callback)}`;
  }
  return Response.redirect(authUrl, 302);
});
