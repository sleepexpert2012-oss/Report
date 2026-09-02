/**
 * Kéo ĐỐI SOÁT TIỀN từng đơn — payment.get_escrow_detail của Shopee.
 *
 * Tách khỏi `ops-sync` để không đụng hàm đang chạy production, và vì bản đang
 * chạy của ops-sync KHÔNG khớp mã trong repo (đã xác nhận: gọi days=600 mà nó
 * chỉ quét 120 ngày). Dùng lại y nguyên env của nó nên không cần thêm khoá nào.
 *
 * Lưu NGUYÊN VĂN `order_income` vào v2_fact_escrow.tho. ops-sync cũ chỉ đọc 13
 * trường rồi bỏ 98 trường còn lại — đó là lý do bảng lãi lỗ thiếu 11/14 khoản
 * phí. Lưu trọn một lần thì sau này thêm khoản phí chỉ cần sửa khung nhìn.
 *
 * Chế độ:
 *   {"mode":"thu"}  — gọi thử N đơn, IN NGUYÊN VĂN, KHÔNG ghi gì. Mặc định.
 *   {"mode":"nap"}  — kéo thật và ghi vào v2_fact_escrow.
 *
 * Tham số: {so: 20} số đơn cho chế độ thu · {lam_lai: true} kéo lại cả đơn đã có
 *          {budget_ms: 120000} ngân sách thời gian
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

/** Tài liệu: order_sn_list nhận 1–50, Shopee khuyến nghị 20. */
const LO = 20;

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

async function goi(path: string, shopId: number, tok: string, p: Record<string, unknown>,
                   kieuMang: "json" | "lap" | "phay" = "json") {
  const ts = Math.floor(Date.now() / 1000);
  const q = new URLSearchParams({
    partner_id: String(PARTNER_ID), timestamp: String(ts), access_token: tok,
    shop_id: String(shopId), sign: await hmac(`${PARTNER_ID}${path}${ts}${tok}${shopId}`),
  });
  for (const [k, v] of Object.entries(p)) {
    if (Array.isArray(v)) {
      // Tài liệu chỉ ghi "format should be string[]" mà không nói mã hoá thế
      // nào trên query string. Ba khuôn có thể: JSON, lặp khoá, nối phẩy.
      // Chỗ gọi sẽ thử lần lượt cho tới khi có khuôn chạy được.
      if (kieuMang === "json") q.append(k, JSON.stringify(v.map(String)));
      else if (kieuMang === "lap") for (const x of v) q.append(k, String(x));
      else q.append(k, v.map(String).join(","));
    } else q.append(k, String(v));
  }
  const r = await fetch(`${HOST}${path}?${q}`);
  return await r.json();
}

type Ket = { order_sn: string; oi: Record<string, unknown> };

/** Khuôn mã hoá mảng mà batch chấp nhận, tự dò ở lô đầu rồi chốt lại. */
let kieuBatch: "json" | "lap" | "phay" | null = null;

/**
 * Lấy escrow cho một lô đơn.
 *
 * Thử `get_escrow_detail_batch` trước (1 lời gọi cho 20 đơn). Nếu endpoint đó
 * không dùng được — thiếu quyền, đổi khuôn phản hồi — thì tự lùi về gọi từng
 * đơn bằng `get_escrow_detail`, cái đã xác nhận chạy được.
 */
async function motLo(shopId: number, tok: string, dons: string[]) {
  const ra: Ket[] = [];
  const nk: Record<string, unknown> = { so_don: dons.length };
  const thu: string[] = [];
  for (const kieu of ["json", "lap", "phay"] as const) {
    if (kieuBatch && kieuBatch !== kieu) continue;
    const j = await goi("/api/v2/payment/get_escrow_detail_batch", shopId, tok,
      { order_sn_list: dons }, kieu);
    const ds = j?.response;
    if (!j?.error && Array.isArray(ds) && ds.length) {
      for (const x of ds) {
        const sn = String(x?.order_sn ?? x?.escrow_detail?.order_sn ?? "");
        const oi = x?.escrow_detail?.order_income ?? x?.order_income;
        if (sn && oi) ra.push({ order_sn: sn, oi });
      }
      if (ra.length) {
        kieuBatch = kieu;               // chốt khuôn, các lô sau khỏi thử lại
        nk.cach = `batch/${kieu}`;
        return { ra, nk };
      }
    }
    thu.push(`${kieu}:${j?.error || "khuôn phản hồi lạ"}`);
    if (kieuBatch) break;
  }
  kieuBatch = null;
  nk.cach = "từng đơn";
  nk.batch_da_thu = thu;
  for (const sn of dons) {
    const k = await goi("/api/v2/payment/get_escrow_detail", shopId, tok, { order_sn: sn });
    const oi = k?.response?.order_income;
    if (oi) ra.push({ order_sn: sn, oi });
  }
  return { ra, nk };
}

const so = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const t0 = Date.now();
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mode = body.mode || "thu";
    const budget = Number(body.budget_ms || 120_000);
    const hetGio = () => Date.now() - t0 > budget;
    const { shopId, tok } = await token();

    // Đơn cần lấy: mọi mã đơn trong sales_fact, bỏ đơn đã có escrow (trừ khi lam_lai).
    const donSet = new Set<string>();
    for (let tu = 0; ; tu += 1000) {
      const { data, error } = await sb.from("sales_fact")
        .select("ma_don_hang").not("ma_don_hang", "is", null).range(tu, tu + 999);
      if (error) throw new Error(`sales_fact: ${error.message}`);
      for (const r of data ?? []) donSet.add(String(r.ma_don_hang));
      if (!data || data.length < 1000) break;
    }
    const daCo = new Set<string>();
    if (!body.lam_lai) {
      for (let tu = 0; ; tu += 1000) {
        const { data } = await sb.from("v2_fact_escrow").select("order_sn").range(tu, tu + 999);
        for (const r of data ?? []) daCo.add(String(r.order_sn));
        if (!data || data.length < 1000) break;
      }
    }
    let canLay = [...donSet].filter((d) => !daCo.has(d)).sort();
    if (mode === "thu") canLay = canLay.slice(0, Number(body.so || LO));

    const nhatKy: Record<string, unknown>[] = [];
    const tatCa: Ket[] = [];
    for (let i = 0; i < canLay.length; i += LO) {
      if (hetGio()) break;
      const { ra, nk } = await motLo(shopId, tok, canLay.slice(i, i + LO));
      nhatKy.push({ ...nk, nhan_ve: ra.length });
      tatCa.push(...ra);
      if (mode === "nap" && tatCa.length >= 200) {
        const { error } = await sb.from("v2_fact_escrow").upsert(
          tatCa.splice(0).map((x) => ({
            order_sn: x.order_sn,
            escrow_amount: so(x.oi.escrow_amount),
            escrow_amount_after_adjustment: so(x.oi.escrow_amount_after_adjustment),
            buyer_total_amount: so(x.oi.buyer_total_amount),
            tho: x.oi, nap_luc: new Date().toISOString(),
          })), { onConflict: "order_sn" });
        if (error) throw new Error(`ghi v2_fact_escrow: ${error.message}`);
      }
    }

    if (mode === "thu") {
      const truong = tatCa.length ? Object.keys(tatCa[0].oi).sort() : [];
      return new Response(JSON.stringify({
        ok: true, mode: "thu", ghi_vao_database: false,
        tong_don: donSet.size, da_co_escrow: daCo.size, con_thieu: donSet.size - daCo.size,
        lay_thu: tatCa.length, so_truong: truong.length, truong,
        nhat_ky: nhatKy, mau: tatCa.slice(0, 2),
      }, null, 1), { headers });
    }

    let daGhi = 0;
    if (tatCa.length) {
      const { error } = await sb.from("v2_fact_escrow").upsert(
        tatCa.map((x) => ({
          order_sn: x.order_sn,
          escrow_amount: so(x.oi.escrow_amount),
          escrow_amount_after_adjustment: so(x.oi.escrow_amount_after_adjustment),
          buyer_total_amount: so(x.oi.buyer_total_amount),
          tho: x.oi, nap_luc: new Date().toISOString(),
        })), { onConflict: "order_sn" });
      if (error) throw new Error(`ghi v2_fact_escrow: ${error.message}`);
      daGhi = tatCa.length;
    }
    const { count } = await sb.from("v2_fact_escrow").select("*", { count: "exact", head: true });
    return new Response(JSON.stringify({
      ok: true, mode: "nap",
      tong_don: donSet.size, can_lay_dau_lan_nay: canLay.length,
      ghi_lan_nay: daGhi, tong_trong_bang: count,
      con_thieu: donSet.size - (count ?? 0),
      het_gio: hetGio(), elapsed_ms: Date.now() - t0,
      nhat_ky: nhatKy.slice(0, 6),
    }, null, 1), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, loi: String((e as Error)?.message ?? e) }),
      { status: 500, headers });
  }
});
