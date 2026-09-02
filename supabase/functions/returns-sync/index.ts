/**
 * Kéo TRẢ HÀNG / HOÀN TIỀN từ đúng module Returns của Shopee.
 *
 * Tách hẳn khỏi `ops-sync` để không đụng vào hàm đang chạy production. Dùng lại
 * y nguyên biến môi trường của ops-sync — SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY
 * / SHOPEE_HOST và bảng `shopee_token` — nên KHÔNG cần khai báo thêm khoá nào.
 *
 * Ba chế độ:
 *   {"mode":"thu"}       — gọi API, IN NGUYÊN VĂN phản hồi, KHÔNG ghi gì.
 *   {"mode":"doi_chieu"} — gọi cả page_no 0 và 1 trên cùng cửa sổ để xem lệch
 *                          nhau ra sao. Cũng không ghi gì.
 *   {"mode":"nap"}       — kéo thật, ghi vào v2_fact_return(_item).
 *
 * Mặc định là "thu": lỡ gọi nhầm thì không có gì bị thay đổi.
 *
 * Tham số: {tu, den} timestamp giây, hoặc {ngay: 30} để lùi N ngày từ hôm nay.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HOST = Deno.env.get("SHOPEE_HOST") ?? "https://partner.shopeemobile.com";
const PARTNER_ID = Number(Deno.env.get("SHOPEE_PARTNER_ID"));
const PARTNER_KEY = Deno.env.get("SHOPEE_PARTNER_KEY") ?? "";
const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

/** Shopee bắt cửa sổ create_time TỐI ĐA 15 ngày. Lấy 14 cho chắc. */
const CUA_SO = 14 * 86400;
/** page_size tối đa theo tài liệu là 100. */
const CO_TRANG = 100;

async function hmac(msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(PARTNER_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function token() {
  const { data } = await sb.from("shopee_token").select("*").limit(1);
  const row = data?.[0];
  if (!row) throw new Error("Chưa có shop token trong bảng shopee_token");
  if (row.expire_at && new Date(String(row.expire_at)).getTime() - Date.now() > 10 * 60 * 1000) {
    return { shopId: Number(row.shop_id), tok: String(row.access_token) };
  }
  const path = "/api/v2/auth/access_token/get";
  const ts = Math.floor(Date.now() / 1000);
  const r = await fetch(`${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${await hmac(`${PARTNER_ID}${path}${ts}`)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: row.refresh_token, shop_id: row.shop_id, partner_id: PARTNER_ID }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`refresh token thất bại: ${JSON.stringify(j)}`);
  await sb.from("shopee_token").upsert({
    shop_id: row.shop_id, access_token: j.access_token,
    refresh_token: j.refresh_token || row.refresh_token,
    expire_at: new Date((ts + (j.expire_in || 14400)) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  return { shopId: Number(row.shop_id), tok: String(j.access_token) };
}

async function goi(path: string, shopId: number, tok: string, p: Record<string, unknown>) {
  const ts = Math.floor(Date.now() / 1000);
  const q = new URLSearchParams({
    partner_id: String(PARTNER_ID), timestamp: String(ts), access_token: tok,
    shop_id: String(shopId), sign: await hmac(`${PARTNER_ID}${path}${ts}${tok}${shopId}`),
    ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
  });
  const r = await fetch(`${HOST}${path}?${q}`);
  return await r.json();
}

/**
 * Lấy mọi yêu cầu trả trong một cửa sổ.
 *
 * `page_no` theo tài liệu là VỊ TRÍ BẢN GHI BẮT ĐẦU, mặc định 0 — không phải số
 * trang. Bản ops-sync cũ bắt đầu ở 1 và tăng 1 mỗi vòng, sai cả hai đằng: bỏ
 * qua bản ghi đầu tiên, rồi nhích từng bản ghi một.
 *
 * Tài liệu Shopee mô tả không nhất quán (Sample ghi 1, mô tả ghi mặc định 0),
 * nên chỗ này viết chịu được CẢ HAI cách hiểu: lọc trùng theo return_sn, và
 * dừng khi một vòng không thêm được bản ghi mới nào.
 */
async function motCuaSo(shopId: number, tok: string, tu: number, den: number) {
  const thay = new Map<string, Record<string, unknown>>();
  const nhatKy: Record<string, unknown>[] = [];
  for (let offset = 0, vong = 0; vong < 50; vong++) {
    const j = await goi("/api/v2/returns/get_return_list", shopId, tok, {
      page_no: offset, page_size: CO_TRANG, create_time_from: tu, create_time_to: den,
    });
    nhatKy.push({ offset, error: j.error ?? "", message: j.message ?? "",
                  so_ban_ghi: (j.response?.return ?? []).length, more: j.response?.more ?? false });
    if (j.error) throw new Error(`get_return_list: ${j.error} ${j.message ?? ""}`);
    const ds = j.response?.return ?? [];
    const truoc = thay.size;
    for (const r of ds) if (r?.return_sn) thay.set(String(r.return_sn), r);
    // Không thêm được gì mới, hoặc Shopee bảo hết trang -> dừng.
    if (thay.size === truoc || !j.response?.more) break;
    offset += ds.length || CO_TRANG;
  }
  return { ds: [...thay.values()], nhatKy };
}

function isoGiay(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mode = body.mode || "thu";
    const now = Math.floor(Date.now() / 1000);
    const den = Number(body.den) || now;
    const tu = Number(body.tu) || den - (Number(body.ngay) || 30) * 86400;
    const { shopId, tok } = await token();

    // ── đối chiếu: cùng cửa sổ, gọi offset 0 và offset 1, xem khác nhau chỗ nào
    if (mode === "doi_chieu") {
      const ra: Record<string, unknown> = { shop_id: shopId, tu, den,
        tu_iso: isoGiay(tu), den_iso: isoGiay(den) };
      for (const offset of [0, 1]) {
        const j = await goi("/api/v2/returns/get_return_list", shopId, tok, {
          page_no: offset, page_size: CO_TRANG, create_time_from: tu, create_time_to: den,
        });
        ra[`page_no_${offset}`] = {
          error: j.error ?? "", message: j.message ?? "",
          so_ban_ghi: (j.response?.return ?? []).length,
          more: j.response?.more ?? null,
          return_sn: (j.response?.return ?? []).map((x: Record<string, unknown>) => x.return_sn),
          nguyen_van: j.response ?? null,
        };
      }
      return new Response(JSON.stringify(ra, null, 1), { headers });
    }

    // ── quét theo cửa sổ 14 ngày
    const tatCa: Record<string, unknown>[] = [];
    const nhatKy: Record<string, unknown>[] = [];
    for (let to = den; to > tu;) {
      const from = Math.max(tu, to - CUA_SO);
      const { ds, nhatKy: nk } = await motCuaSo(shopId, tok, from, to);
      nhatKy.push({ tu: isoGiay(from), den: isoGiay(to), so_ban_ghi: ds.length, goi: nk });
      tatCa.push(...ds);
      to = from - 1;
    }
    const rieng = [...new Map(tatCa.map((x) => [String(x.return_sn), x])).values()];

    if (mode === "thu") {
      return new Response(JSON.stringify({
        ok: true, mode: "thu", ghi_vao_database: false,
        khoang: { tu: isoGiay(tu), den: isoGiay(den) },
        so_yeu_cau_tra: rieng.length,
        tong_tien_hoan: rieng.reduce((s, x) => s + (Number(x.refund_amount) || 0), 0),
        nhat_ky_goi: nhatKy,
        nguyen_van: rieng,
      }, null, 1), { headers });
    }

    if (mode !== "nap") throw new Error(`mode không hợp lệ: ${mode}`);

    // ── ghi vào bảng v2. Chỉ chạm v2_fact_return(_item), không đụng sales_fact.
    const dau = rieng.map((x) => ({
      return_sn: String(x.return_sn), order_sn: String(x.order_sn ?? ""),
      status: x.status ?? null, negotiation_status: x.negotiation_status ?? null,
      reason: x.reason ?? null, text_reason: x.text_reason ?? null,
      refund_amount: Number(x.refund_amount) || 0, currency: x.currency ?? null,
      amount_before_discount: Number(x.amount_before_discount) || null,
      needs_logistics: typeof x.needs_logistics === "boolean" ? x.needs_logistics : null,
      tracking_number: x.tracking_number ?? null,
      create_time: isoGiay(x.create_time), update_time: isoGiay(x.update_time),
      nap_luc: new Date().toISOString(),
    }));
    const mon: Record<string, unknown>[] = [];
    for (const x of rieng) {
      const items = (x.item ?? x.item_list ?? []) as Record<string, unknown>[];
      items.forEach((it, i) => mon.push({
        return_sn: String(x.return_sn), vi_tri: i,
        item_id: it.item_id ?? null, model_id: it.model_id ?? null,
        item_sku: it.item_sku ?? null, variation_sku: it.variation_sku ?? null,
        ten: it.name ?? null,
        so_luong: Number(it.amount) || 0,   // tài liệu: item[].amount = số lượng
        gia: Number(it.item_price) || null,
      }));
    }
    if (dau.length) {
      const e1 = (await sb.from("v2_fact_return").upsert(dau, { onConflict: "return_sn" })).error;
      if (e1) throw new Error(`ghi v2_fact_return: ${e1.message}`);
      const e2 = (await sb.from("v2_fact_return_item").upsert(mon, { onConflict: "return_sn,vi_tri" })).error;
      if (e2) throw new Error(`ghi v2_fact_return_item: ${e2.message}`);
    }
    return new Response(JSON.stringify({
      ok: true, mode: "nap", khoang: { tu: isoGiay(tu), den: isoGiay(den) },
      da_ghi_yeu_cau_tra: dau.length, da_ghi_dong_san_pham: mon.length,
      tong_tien_hoan: dau.reduce((s, x) => s + x.refund_amount, 0),
      nhat_ky_goi: nhatKy,
    }, null, 1), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, loi: String((e as Error)?.message ?? e) }),
      { status: 500, headers });
  }
});
