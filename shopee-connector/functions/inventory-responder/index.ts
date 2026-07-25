import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PARTNER_ID = Number(Deno.env.get("SHOPEE_PARTNER_ID"));
const PARTNER_KEY = (Deno.env.get("SHOPEE_PARTNER_KEY") || "").trim();
const HOST = (Deno.env.get("SHOPEE_HOST") || "https://partner.shopeemobile.com").trim();
const ALLOW_EMPTY = (Deno.env.get("SHOPEE_ALLOW_EMPTY_INVENTORY_SYNC") || "") === "true";
const sb = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);

type TokenRow = {
  shop_id: number;
  access_token: string;
  refresh_token: string;
  expire_at?: string;
};

type InventoryRow = {
  sku_khoa: string;
  ten_san_pham: string;
  ma_kho_khoa: string;
  ten_kho: string;
  ton_hien_tai: string;
  ton_kha_dung: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function assertConfig() {
  const missing = [];
  if (!PARTNER_ID) missing.push("SHOPEE_PARTNER_ID");
  if (!PARTNER_KEY) missing.push("SHOPEE_PARTNER_KEY");
  if (!Deno.env.get("SUPABASE_URL")) missing.push("SUPABASE_URL");
  if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) throw new Error(`Thiếu biến môi trường: ${missing.join(", ")}`);
}

async function hmac(base: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PARTNER_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(base),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function shopUrl(
  path: string,
  shopId: number,
  token: string,
  extra: Record<string, string | number | boolean> = {},
) {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = await hmac(`${PARTNER_ID}${path}${timestamp}${token}${shopId}`);
  const query = new URLSearchParams({
    partner_id: String(PARTNER_ID),
    timestamp: String(timestamp),
    access_token: token,
    shop_id: String(shopId),
    sign,
    ...Object.fromEntries(
      Object.entries(extra).map(([key, value]) => [key, String(value)]),
    ),
  });
  return `${HOST}${path}?${query}`;
}

async function refreshIfNeeded(token: TokenRow): Promise<TokenRow> {
  if (
    token.expire_at &&
    new Date(token.expire_at).getTime() - Date.now() > 10 * 60 * 1000
  ) return token;

  const path = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = await hmac(`${PARTNER_ID}${path}${timestamp}`);
  const response = await fetch(
    `${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        refresh_token: token.refresh_token,
        shop_id: token.shop_id,
        partner_id: PARTNER_ID,
      }),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(`Không refresh được token: ${JSON.stringify(payload)}`);
  }
  const updated: TokenRow = {
    shop_id: token.shop_id,
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || token.refresh_token,
    expire_at: new Date(
      (timestamp + (payload.expire_in || 14400)) * 1000,
    ).toISOString(),
  };
  const { error } = await sb.from("shopee_token").upsert({
    ...updated,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Không lưu được token: ${error.message}`);
  return updated;
}

async function shopeeGet(
  path: string,
  shopId: number,
  token: string,
  params: Record<string, string | number | boolean>,
) {
  const url = await shopUrl(path, shopId, token, params);
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(
      `${path}: ${payload.error || response.status} ${payload.message || ""}`.trim(),
    );
  }
  return payload.response || {};
}

async function listItemIds(shopId: number, token: string) {
  const ids = new Set<number>();
  for (const status of ["NORMAL", "UNLIST"]) {
    let offset = 0;
    while (true) {
      const response = await shopeeGet(
        "/api/v2/product/get_item_list",
        shopId,
        token,
        { offset, page_size: 100, item_status: status },
      );
      const items = response.item || response.item_list || [];
      for (const item of items) {
        const itemId = Number(item.item_id);
        if (itemId) ids.add(itemId);
      }
      if (!response.has_next_page || !items.length) break;
      offset = Number(response.next_offset ?? offset + items.length);
    }
  }
  return [...ids];
}

function stockOf(entity: Record<string, unknown>) {
  const v2 = (entity.stock_info_v2 || {}) as Record<string, unknown>;
  const summary = (v2.summary_info || {}) as Record<string, unknown>;
  const available = Number(summary.total_available_stock);
  if (Number.isFinite(available)) return Math.max(0, available);

  const sellerStock = Array.isArray(v2.seller_stock) ? v2.seller_stock : [];
  if (sellerStock.length) {
    return sellerStock.reduce(
      (sum: number, row: Record<string, unknown>) =>
        sum + Math.max(0, Number(row.stock) || 0),
      0,
    );
  }

  const legacy = Array.isArray(entity.stock_info) ? entity.stock_info : [];
  if (legacy.length) {
    return legacy.reduce(
      (sum: number, row: Record<string, unknown>) =>
        sum + Math.max(0, Number(row.current_stock ?? row.stock) || 0),
      0,
    );
  }
  return Math.max(0, Number(entity.stock ?? entity.normal_stock) || 0);
}

function inventoryRow(sku: string, name: string, stock: number): InventoryRow {
  return {
    sku_khoa: sku.trim(),
    ten_san_pham: name.trim(),
    ma_kho_khoa: "WH04",
    ten_kho: "Kho Shopee Ecommerce",
    ton_hien_tai: String(Math.max(0, Math.round(stock))),
    ton_kha_dung: "Có",
  };
}

async function insertInventory(rows: InventoryRow[]) {
  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await sb.from("tonkho").insert(rows.slice(index, index + 500));
    if (error) throw new Error(error.message);
  }
}

async function replaceInventory(rows: InventoryRow[]) {
  const { data: previous, error: readError } = await sb.from("tonkho").select(
    "sku_khoa,ten_san_pham,ma_kho_khoa,ten_kho,ton_hien_tai,ton_kha_dung",
  );
  if (readError) throw new Error(`Không sao lưu được tồn cũ: ${readError.message}`);

  const { error: deleteError } = await sb.from("tonkho").delete().gte("_id", 0);
  if (deleteError) throw new Error(`Không xóa được tồn cũ: ${deleteError.message}`);
  try {
    await insertInventory(rows);
  } catch (writeError) {
    // Khôi phục dữ liệu trước đồng bộ nếu bước insert mới thất bại.
    await sb.from("tonkho").delete().gte("_id", 0);
    const restoreRows = (previous || []) as InventoryRow[];
    try {
      await insertInventory(restoreRows);
    } catch (restoreError) {
      throw new Error(
        `Ghi tồn mới lỗi (${String(writeError)}); khôi phục cũng lỗi (${String(restoreError)})`,
      );
    }
    throw new Error(`Không ghi được tồn mới; đã khôi phục tồn cũ: ${String(writeError)}`);
  }
}

Deno.serve(async () => {
  const startedAt = Date.now();
  try {
    assertConfig();
    const { data: tokens, error: tokenError } = await sb
      .from("shopee_token")
      .select("*");
    if (tokenError) throw new Error(tokenError.message);
    if (!tokens?.length) return json({ ok: false, error: "Shop chưa được ủy quyền" }, 409);

    const rowsBySku = new Map<string, InventoryRow>();
    let itemCount = 0;
    let modelCount = 0;
    const skipped: Array<{ item_id: number; reason: string }> = [];

    for (const rawToken of tokens as TokenRow[]) {
      const token = await refreshIfNeeded(rawToken);
      const itemIds = await listItemIds(token.shop_id, token.access_token);
      itemCount += itemIds.length;

      for (let index = 0; index < itemIds.length; index += 50) {
        const batch = itemIds.slice(index, index + 50);
        const base = await shopeeGet(
          "/api/v2/product/get_item_base_info",
          token.shop_id,
          token.access_token,
          {
            item_id_list: batch.join(","),
            need_tax_info: false,
            need_complaint_policy: false,
          },
        );
        for (const item of base.item_list || []) {
          const itemId = Number(item.item_id);
          const itemName = String(item.item_name || "");
          if (item.has_model) {
            const models = await shopeeGet(
              "/api/v2/product/get_model_list",
              token.shop_id,
              token.access_token,
              { item_id: itemId },
            );
            for (const model of models.model || models.model_list || []) {
              const sku = String(model.model_sku || "").trim();
              if (!sku) {
                skipped.push({ item_id: itemId, reason: "model_sku trống" });
                continue;
              }
              modelCount += 1;
              const name = `${itemName} — ${String(model.model_name || "").trim()}`;
              const stock = stockOf(model);
              const existing = rowsBySku.get(sku);
              rowsBySku.set(
                sku,
                inventoryRow(sku, name, stock + Number(existing?.ton_hien_tai || 0)),
              );
            }
          } else {
            const sku = String(item.item_sku || "").trim();
            if (!sku) {
              skipped.push({ item_id: itemId, reason: "item_sku trống" });
              continue;
            }
            const stock = stockOf(item);
            const existing = rowsBySku.get(sku);
            rowsBySku.set(
              sku,
              inventoryRow(
                sku,
                itemName,
                stock + Number(existing?.ton_hien_tai || 0),
              ),
            );
          }
        }
      }
    }

    const rows = [...rowsBySku.values()];
    if (!rows.length && !ALLOW_EMPTY) {
      throw new Error(
        "Shopee trả về 0 SKU; giữ nguyên bảng tonkho để tránh mất dữ liệu",
      );
    }

    // Chỉ thay dữ liệu cũ sau khi toàn bộ API đã tải và chuyển đổi thành công.
    await replaceInventory(rows);
    await sb
      .from("dim_kho")
      .update({
        ten_kho: "Kho Shopee Ecommerce",
        ton_kha_dung: "Có",
        ghi_chu: "Tồn khả dụng đồng bộ tự động từ Shopee Product API",
      })
      .eq("ma_kho_khoa", "WH04");

    return json({
      ok: true,
      items: itemCount,
      models: modelCount,
      skus: rows.length,
      total_available_stock: rows.reduce(
        (sum, row) => sum + Number(row.ton_hien_tai || 0),
        0,
      ),
      skipped: skipped.slice(0, 30),
      duration_ms: Date.now() - startedAt,
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: String(error instanceof Error ? error.message : error),
        duration_ms: Date.now() - startedAt,
      },
      500,
    );
  }
});
