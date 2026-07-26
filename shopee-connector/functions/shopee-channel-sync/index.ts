import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HOST = (Deno.env.get("SHOPEE_HOST") || "https://partner.shopeemobile.com").trim();
const sb = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);
type AppKey = "affiliate" | "live" | "video";
const configs: Record<AppKey, { id: number; key: string; paths: string[] }> = {
  affiliate: {
    id: Number(Deno.env.get("SHOPEE_AFFILIATE_PARTNER_ID")),
    key: (Deno.env.get("SHOPEE_AFFILIATE_PARTNER_KEY") || "").trim(),
    paths: [
      "/api/v2/ams/get_affiliate_performance",
      "/api/v2/ams/get_product_performance",
      "/api/v2/ams/get_open_campaign_performance",
      "/api/v2/ams/get_targeted_campaign_performance",
      "/api/v2/ams/get_managed_affiliate_list",
    ],
  },
  live: {
    id: Number(Deno.env.get("SHOPEE_LIVE_PARTNER_ID")),
    key: (Deno.env.get("SHOPEE_LIVE_PARTNER_KEY") || "").trim(),
    paths: [
      "/api/v2/livestream/get_livestream_list",
      "/api/v2/livestream/get_livestream_performance",
      "/api/v2/live/get_live_list",
      "/api/v2/live/get_live_performance",
    ],
  },
  video: {
    id: Number(Deno.env.get("SHOPEE_VIDEO_PARTNER_ID")),
    key: (Deno.env.get("SHOPEE_VIDEO_PARTNER_KEY") || "").trim(),
    paths: [
      "/api/v2/video/get_video_list",
      "/api/v2/video/get_overview_performance",
      "/api/v2/video/get_metric_trend",
      "/api/v2/video/get_prodcut_performance_list",
      "/api/v2/video/get_video_performance_list",
    ],
  },
};
const responseHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "content-type": "application/json; charset=utf-8",
};
async function sign(key: string, base: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const raw = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(base));
  return [...new Uint8Array(raw)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function refresh(app: AppKey, row: Record<string, unknown>) {
  if (row.expire_at && new Date(String(row.expire_at)).getTime() - Date.now() > 10 * 60 * 1000) return row;
  const isUserApp = app === "live" || app === "video";
  const cfg = configs[app], path = "/api/v2/auth/access_token/get";
  const ts = Math.floor(Date.now() / 1000);
  const sig = await sign(cfg.key, `${cfg.id}${path}${ts}`);
  const r = await fetch(`${HOST}${path}?partner_id=${cfg.id}&timestamp=${ts}&sign=${sig}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      refresh_token: row.refresh_token,
      ...(isUserApp ? { user_id: row.user_id } : { shop_id: row.shop_id }),
      partner_id: cfg.id,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`refresh ${app}: ${j.error || j.message || "unknown"}`);
  const upd = {
    app_key: app, shop_id: row.shop_id, user_id: row.user_id || j.user_id || null,
    access_token: j.access_token,
    refresh_token: j.refresh_token || row.refresh_token,
    expire_at: new Date((ts + (j.expire_in || 14400)) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  await sb.from("shopee_app_token").upsert(upd);
  return upd;
}
async function get(app: AppKey, row: Record<string, unknown>, path: string, extra: Record<string, unknown>) {
  const cfg = configs[app], ts = Math.floor(Date.now() / 1000);
  const identity = app === "live" || app === "video" ? row.user_id : row.shop_id;
  if (!identity) throw new Error(`${app} chưa có user_id; cần uỷ quyền lại theo luồng User API.`);
  const sig = await sign(cfg.key, `${cfg.id}${path}${ts}${row.access_token}${identity}`);
  const q = new URLSearchParams({
    partner_id: String(cfg.id), timestamp: String(ts), sign: sig,
    access_token: String(row.access_token),
    [app === "live" || app === "video" ? "user_id" : "shop_id"]: String(identity),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
  });
  const r = await fetch(`${HOST}${path}?${q}`);
  return await r.json();
}

function baseParams(now: number) {
  return {
    start_time: now - 7 * 86400,
    end_time: now,
    start_date: new Date((now - 7 * 86400) * 1000).toISOString().slice(0, 10),
    end_date: new Date(now * 1000).toISOString().slice(0, 10),
    page_no: 1,
    page_size: 10,
    offset: 0,
    limit: 10,
  };
}

function parameterCandidates(
  app: AppKey,
  path: string,
  row: Record<string, unknown>,
  now: number,
) {
  const common = baseParams(now);
  if (app === "affiliate" && path.includes("campaign_performance")) {
    return [0, 1, 2, 3, "DAY", "DAILY", "WEEK", "MONTH"].map((periodType) => ({
      ...common,
      period_type: periodType,
    }));
  }
  if (app === "affiliate" && path.includes("_performance")) {
    return [0, 1, 2, 3, "ALL", "VALIDATED", "PENDING", "COMPLETED"].map(
      (orderType) => ({ ...common, order_type: orderType }),
    );
  }
  if (app === "video") {
    const endDate = new Date((now - 86400) * 1000).toISOString().slice(0, 10);
    if (path.endsWith("/get_video_list")) {
      return [2].map((listType) => ({
        page_no: 1,
        page_size: 20,
        list_type: listType,
      }));
    }
    if (path.endsWith("/get_video_performance_list")) {
      return [{
        page_no: 1,
        page_size: 20,
        period_type: "Last7d",
        end_date: endDate,
        order_by: "Views",
        sort: "desc",
      }];
    }
    if (path.endsWith("/get_prodcut_performance_list")) {
      return [{
        page_no: 1,
        page_size: 20,
        period_type: "Last7d",
        end_date: endDate,
        order_by: "PlacedSales",
        sort: "desc",
      }];
    }
    return [{ period_type: "Last7d", end_date: endDate }];
  }
  return [common];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: responseHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const apps: AppKey[] = body.app ? [body.app] : ["affiliate", "live", "video"];
    const now = Math.floor(Date.now() / 1000);
    const output: Record<string, unknown> = {};
    for (const app of apps) {
      if (!configs[app]) throw new Error(`App không hợp lệ: ${app}`);
      const { data } = await sb.from("shopee_app_token").select("*").eq("app_key", app).limit(1);
      if (!data?.length) { output[app] = { authorized: false }; continue; }
      const tok = await refresh(app, data[0]);
      const probes = [];
      for (const path of configs[app].paths) {
        let j: any = {};
        let acceptedParams: Record<string, unknown> | null = null;
        const attempts = [];
        for (const params of parameterCandidates(app, path, tok, now)) {
          j = await get(app, tok, path, params);
          attempts.push({
            params,
            error: j.error || "",
            message: j.message || "",
          });
          if (!j.error || !/invalid .*type|no user_id/i.test(String(j.message || ""))) {
            acceptedParams = params;
            break;
          }
        }
        probes.push({
          path, ok: !j.error, error: j.error || "", message: j.message || "",
          response_keys: j.response ? Object.keys(j.response) : [],
          accepted_params: acceptedParams,
          attempts,
        });
        if (!j.error && j.response) {
          const factDate = String(
            acceptedParams?.end_date ||
              new Date((now - 86400) * 1000).toISOString().slice(0, 10),
          );
          const entityId = path.split("/").pop() || path;
          const { error: saveError } = await sb.from("shopee_channel_fact").upsert({
            source: app,
            fact_date: factDate,
            entity_id: entityId,
            dimensions: {
              api_path: path,
              params: acceptedParams || {},
              user_id: tok.user_id || null,
            },
            metrics: j.response,
            updated_at: new Date().toISOString(),
          });
          if (saveError) throw new Error(`Lưu ${app}/${entityId}: ${saveError.message}`);
        }
      }
      output[app] = { authorized: true, probes };
    }
    return new Response(JSON.stringify({ ok: true, output }), { headers: responseHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: responseHeaders,
    });
  }
});
