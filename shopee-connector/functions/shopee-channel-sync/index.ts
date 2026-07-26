import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HOST = (Deno.env.get("SHOPEE_HOST") || "https://partner.shopeemobile.com").trim();
const sb = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);

type AppKey = "affiliate" | "live" | "video";
type TokenRow = Record<string, any>;
type Params = Record<string, string | number | boolean>;
type Endpoint = {
  path: string;
  params: (ctx: SyncContext) => Params[];
  paged?: "page_no" | "offset";
  pageSize?: number;
  dependsOn?: "video";
};
type AppConfig = {
  id: number;
  key: string;
  identity: "shop_id" | "user_id";
  endpoints: Endpoint[];
};
type SyncContext = {
  now: number;
  startDate: string;
  endDate: string;
  startTime: number;
  endTime: number;
  videoPosts: string[];
};

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const fixed = (p: Params) => () => [p];
const reportParams = (ctx: SyncContext) => ({
  period_type: "Last30d",
  start_date: ctx.startDate,
  end_date: ctx.endDate,
});
const affiliatePerformance = (ctx: SyncContext) => ({
  ...reportParams(ctx),
  page_no: 1,
  page_size: 20,
  order_type: "ConfirmedOrder",
  channel: "AllChannel",
});
const videoPeriod = (ctx: SyncContext) => ({
  period_type: "Last30d",
  end_date: isoDate(new Date(ctx.endTime * 1000)),
});

const configs: Record<AppKey, AppConfig> = {
  affiliate: {
    id: Number(Deno.env.get("SHOPEE_AFFILIATE_PARTNER_ID")),
    key: (Deno.env.get("SHOPEE_AFFILIATE_PARTNER_KEY") || "").trim(),
    identity: "shop_id",
    endpoints: [
      { path: "/api/v2/ams/get_performance_data_update_time", params: fixed({ marker_type: "AmsMarker" }) },
      { path: "/api/v2/ams/get_shop_performance", params: (c) => [{ ...reportParams(c), order_type: "ConfirmedOrder", channel: "AllChannel" }] },
      { path: "/api/v2/ams/get_campaign_key_metrics_performance", params: (c) => [reportParams(c)] },
      { path: "/api/v2/ams/get_product_performance", params: (c) => [affiliatePerformance(c)], paged: "page_no", pageSize: 20 },
      { path: "/api/v2/ams/get_affiliate_performance", params: (c) => [affiliatePerformance(c)], paged: "page_no", pageSize: 20 },
      {
        path: "/api/v2/ams/get_content_performance",
        params: (c) => ["ShopeeVideo", "LiveStreaming"].map((channel) => ({
          ...affiliatePerformance(c),
          channel,
        })),
        paged: "page_no",
        pageSize: 20,
      },
      { path: "/api/v2/ams/get_open_campaign_performance", params: (c) => [{ ...reportParams(c), page_no: 1, page_size: 20 }], paged: "page_no", pageSize: 20 },
      { path: "/api/v2/ams/get_targeted_campaign_performance", params: (c) => [{ ...reportParams(c), page_no: 1, page_size: 20 }], paged: "page_no", pageSize: 20 },
      { path: "/api/v2/ams/get_conversion_report", params: (c) => [{ page_no: 1, page_size: 100, place_order_time_start: c.startTime, place_order_time_end: c.endTime }], paged: "page_no", pageSize: 100 },
      { path: "/api/v2/ams/get_validation_list", params: fixed({}) },
      { path: "/api/v2/ams/get_managed_affiliate_list", params: fixed({ page_no: 1, page_size: 100 }), paged: "page_no", pageSize: 100 },
      { path: "/api/v2/ams/get_targeted_campaign_list", params: fixed({ page_no: 1, page_size: 100 }), paged: "page_no", pageSize: 100 },
      { path: "/api/v2/ams/get_recommended_affiliate_list", params: fixed({ page_size: 100 }) },
    ],
  },
  live: {
    id: Number(Deno.env.get("SHOPEE_LIVE_PARTNER_ID")),
    key: (Deno.env.get("SHOPEE_LIVE_PARTNER_KEY") || "").trim(),
    identity: "user_id",
    endpoints: [
      { path: "/api/v2/livestream/get_item_set_list", params: fixed({ offset: 0, page_size: 100 }), paged: "offset", pageSize: 100 },
      { path: "/api/v2/livestream/get_like_item_list", params: fixed({ offset: 0, page_size: 100 }), paged: "offset", pageSize: 100 },
      { path: "/api/v2/livestream/get_recent_item_list", params: fixed({ offset: 0, page_size: 100 }), paged: "offset", pageSize: 100 },
    ],
  },
  video: {
    id: Number(Deno.env.get("SHOPEE_VIDEO_PARTNER_ID")),
    key: (Deno.env.get("SHOPEE_VIDEO_PARTNER_KEY") || "").trim(),
    identity: "user_id",
    endpoints: [
      { path: "/api/v2/video/get_video_list", params: () => [1, 2].map((list_type) => ({ page_no: 1, page_size: 20, list_type })), paged: "page_no", pageSize: 20 },
      { path: "/api/v2/video/get_overview_performance", params: (c) => [videoPeriod(c)] },
      { path: "/api/v2/video/get_metric_trend", params: (c) => [videoPeriod(c)] },
      { path: "/api/v2/video/get_user_demographics", params: fixed({}) },
      { path: "/api/v2/video/get_video_performance_list", params: (c) => [{ ...videoPeriod(c), page_no: 1, page_size: 20, order_by: "Views", sort: "desc" }], paged: "page_no", pageSize: 20 },
      { path: "/api/v2/video/get_prodcut_performance_list", params: (c) => [{ ...videoPeriod(c), page_no: 1, page_size: 20, order_by: "PlacedSales", sort: "desc" }], paged: "page_no", pageSize: 20 },
      { path: "/api/v2/video/get_video_detail", params: (c) => c.videoPosts.map((post_id) => ({ post_id })), dependsOn: "video" },
      { path: "/api/v2/video/get_video_detail_performance", params: (c) => c.videoPosts.map((post_id) => ({ post_id })), dependsOn: "video" },
      { path: "/api/v2/video/get_video_detail_audience_distribution", params: (c) => c.videoPosts.map((post_id) => ({ post_id })), dependsOn: "video" },
      { path: "/api/v2/video/get_video_detail_product_performance", params: (c) => c.videoPosts.map((post_id) => ({ post_id, page_no: 1, page_size: 20 })), paged: "page_no", pageSize: 20, dependsOn: "video" },
    ],
  },
};

const responseHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "content-type": "application/json; charset=utf-8",
};

async function sign(key: string, base: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const raw = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(base));
  return [...new Uint8Array(raw)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function refresh(app: AppKey, row: TokenRow) {
  if (row.expire_at && new Date(String(row.expire_at)).getTime() - Date.now() > 10 * 60 * 1000) return row;
  const cfg = configs[app];
  const path = "/api/v2/auth/access_token/get";
  const ts = Math.floor(Date.now() / 1000);
  const sig = await sign(cfg.key, `${cfg.id}${path}${ts}`);
  const body = cfg.identity === "user_id"
    ? { refresh_token: row.refresh_token, user_id: row.user_id, partner_id: cfg.id }
    : { refresh_token: row.refresh_token, shop_id: row.shop_id, partner_id: cfg.id };
  const r = await fetch(`${HOST}${path}?partner_id=${cfg.id}&timestamp=${ts}&sign=${sig}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`refresh ${app}: ${j.error || j.message || "unknown"}`);
  const upd = {
    app_key: app,
    shop_id: row.shop_id,
    user_id: row.user_id || j.user_id || j.user_id_list?.[0] || null,
    access_token: j.access_token,
    refresh_token: j.refresh_token || row.refresh_token,
    expire_at: new Date((ts + (j.expire_in || 14400)) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  await sb.from("shopee_app_token").upsert(upd);
  return upd;
}

async function apiGet(app: AppKey, row: TokenRow, path: string, extra: Params) {
  const cfg = configs[app];
  const identity = row[cfg.identity];
  if (!identity) throw new Error(`${app} chưa có ${cfg.identity}; cần uỷ quyền lại.`);
  const ts = Math.floor(Date.now() / 1000);
  const sig = await sign(cfg.key, `${cfg.id}${path}${ts}${row.access_token}${identity}`);
  const query = new URLSearchParams({
    partner_id: String(cfg.id),
    timestamp: String(ts),
    sign: sig,
    access_token: String(row.access_token),
    [cfg.identity]: String(identity),
    ...Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, String(value)])),
  });
  const response = await fetch(`${HOST}${path}?${query}`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${path}: HTTP ${response.status}, phản hồi không phải JSON`);
  }
}

function arrays(value: any, output: any[][] = []) {
  if (Array.isArray(value)) {
    output.push(value);
    for (const item of value) arrays(item, output);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) arrays(item, output);
  }
  return output;
}

function largestList(response: any) {
  return arrays(response).sort((a, b) => b.length - a.length)[0] || [];
}

function hasNext(response: any, count: number, pageSize: number) {
  const flags = [
    response?.more,
    response?.has_more,
    response?.has_next_page,
    response?.page_info?.has_more,
  ].filter((value) => typeof value === "boolean");
  if (flags.length) return flags.some(Boolean);
  return count >= pageSize;
}

function collectPostIds(value: any, out = new Set<string>()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPostIds(item, out));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "post_id" && item) out.add(String(item));
      else collectPostIds(item, out);
    }
  }
  return out;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithRetry(app: AppKey, token: TokenRow, path: string, params: Params) {
  let last: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    last = await apiGet(app, token, path, params);
    if (!last.error) return last;
    const limited = /rate|too many|frequency|thrott/i.test(`${last.error} ${last.message}`);
    if (!limited) return last;
    await sleep(500 * 2 ** attempt);
  }
  return last;
}

async function saveCheckpoint(
  app: AppKey,
  endpoint: Endpoint,
  scopeKey: string,
  patch: Record<string, unknown>,
) {
  await sb.from("shopee_sync_checkpoint").upsert({
    app_key: app,
    module: app,
    endpoint: endpoint.path,
    scope_key: scopeKey,
    ...patch,
  });
}

async function syncEndpoint(
  app: AppKey,
  token: TokenRow,
  endpoint: Endpoint,
  baseParams: Params,
  scopeKey: string,
  ctx: SyncContext,
) {
  const startedAt = new Date().toISOString();
  await saveCheckpoint(app, endpoint, scopeKey, {
    status: "running",
    last_attempt_at: startedAt,
    error_code: null,
    error_message: null,
  });
  const pages: any[] = [];
  let params = { ...baseParams };
  let rows = 0;
  let page = 0;
  try {
    while (page < 100) {
      const json = await callWithRetry(app, token, endpoint.path, params);
      if (json.error) throw Object.assign(new Error(json.message || json.error), { code: json.error });
      pages.push(json.response || {});
      const list = largestList(json.response);
      rows += list.length;
      page++;
      if (!endpoint.paged || !hasNext(json.response, list.length, endpoint.pageSize || 100)) break;
      if (endpoint.paged === "page_no") params.page_no = Number(params.page_no || 1) + 1;
      else params.offset = Number(params.offset || 0) + (endpoint.pageSize || 100);
      await sleep(140);
    }
    const entity = endpoint.path.split("/").pop() || endpoint.path;
    const merged = pages.length === 1 ? pages[0] : { pages };
    const syncedAt = new Date().toISOString();
    const save = {
      app_key: app,
      module: app,
      endpoint: endpoint.path,
      scope_key: scopeKey,
      entity_id: scopeKey,
      fact_date: isoDate(new Date(ctx.endTime * 1000)),
      dimensions: { api_path: endpoint.path, params: baseParams, pages: page },
      metrics: merged,
      raw_payload: merged,
      synced_at: syncedAt,
    };
    const { error: factError } = await sb.from("shopee_api_fact").upsert(save);
    if (factError) throw factError;
    await sb.from("shopee_channel_fact").upsert({
      source: app,
      fact_date: save.fact_date,
      entity_id: scopeKey === "default" ? entity : `${entity}:${scopeKey}`,
      dimensions: save.dimensions,
      metrics: merged,
      updated_at: syncedAt,
    });
    await saveCheckpoint(app, endpoint, scopeKey, {
      status: "complete",
      cursor: {},
      rows_synced: rows,
      pages_synced: page,
      data_through: syncedAt,
      last_success_at: syncedAt,
      next_retry_at: null,
      metadata: { params: baseParams },
    });
    return { ok: true, path: endpoint.path, scope: scopeKey, rows, pages: page, response: merged };
  } catch (error) {
    const code = String((error as any)?.code || "sync_error");
    const message = String((error as any)?.message || error);
    await saveCheckpoint(app, endpoint, scopeKey, {
      status: code === "error_auth" || /permission|scope|authorize/i.test(message) ? "blocked" : "error",
      rows_synced: rows,
      pages_synced: page,
      error_code: code,
      error_message: message.slice(0, 1000),
      next_retry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    return { ok: false, path: endpoint.path, scope: scopeKey, rows, pages: page, error: code, message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: responseHeaders });
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const requested: AppKey[] = body.app ? [body.app] : ["affiliate", "video", "live"];
  const days = Math.min(90, Math.max(7, Number(body.days || 30)));
  const now = Math.floor(Date.now() / 1000);
  const endTime = now - 86400;
  const startTime = endTime - (days - 1) * 86400;
  const ctx: SyncContext = {
    now,
    startTime,
    endTime,
    startDate: ymd(new Date(startTime * 1000)),
    endDate: ymd(new Date(endTime * 1000)),
    videoPosts: [],
  };
  const output: Record<string, any> = {};

  for (const app of requested) {
    const cfg = configs[app];
    if (!cfg) {
      output[app] = { authorized: false, error: "App không hợp lệ" };
      continue;
    }
    if (!cfg.id || !cfg.key) {
      output[app] = { authorized: false, error: "Thiếu Partner ID/Partner Key" };
      continue;
    }
    try {
      const { data } = await sb.from("shopee_app_token").select("*").eq("app_key", app).limit(1);
      if (!data?.length) {
        output[app] = { authorized: false, error: "Chưa uỷ quyền" };
        continue;
      }
      const token = await refresh(app, data[0]);
      if (app === "affiliate") {
        await sb.from("shopee_sync_checkpoint")
          .delete()
          .eq("app_key", "affiliate")
          .eq("scope_key", "ShopeeLive");
      }
      const endpoints: any[] = [];
      for (const endpoint of cfg.endpoints) {
        if (endpoint.dependsOn === "video" && !ctx.videoPosts.length) continue;
        const variants = endpoint.params(ctx);
        if (!variants.length) continue;
        for (let i = 0; i < variants.length; i++) {
          const scope = String(
            variants[i].post_id ||
              variants[i].channel ||
              variants[i].list_type ||
              (variants.length > 1 ? i + 1 : "default"),
          );
          const result = await syncEndpoint(app, token, endpoint, variants[i], scope, ctx);
          endpoints.push({ ...result, response: undefined });
          if (app === "video" && endpoint.path.endsWith("/get_video_list") && result.ok) {
            ctx.videoPosts.push(...collectPostIds(result.response));
            ctx.videoPosts = [...new Set(ctx.videoPosts)].slice(0, 200);
          }
          await sleep(120);
        }
      }
      output[app] = {
        authorized: true,
        endpoints,
        complete: endpoints.filter((item) => item.ok).length,
        failed: endpoints.filter((item) => !item.ok).length,
      };
    } catch (error) {
      output[app] = {
        authorized: true,
        complete: 0,
        failed: 1,
        error: String((error as any)?.message || error),
      };
    }
  }

  return new Response(JSON.stringify({ ok: true, period_days: days, output }), {
    headers: responseHeaders,
  });
});
