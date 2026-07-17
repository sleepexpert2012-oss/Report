// Supabase Edge Function: shopee-auth
// Bước ỦY QUYỀN 1 lần: mở function này trên trình duyệt -> nó đưa link Authorize của Shopee.
// Sau khi seller bấm đồng ý, Shopee gọi lại (?code=&shop_id=) -> function đổi code lấy token và lưu vào bảng shopee_token.
//
// Biến môi trường cần đặt (Supabase -> Edge Functions -> Secrets):
//   SHOPEE_PARTNER_ID   = 1238417
//   SHOPEE_PARTNER_KEY  = <partner key BÍ MẬT của anh>   (KHÔNG chia sẻ)
//   SHOPEE_HOST         = https://partner.shopeemobile.com          (production)
//                         hoặc https://partner.test-stable.shopeemobile.com (sandbox)
//   SELF_URL            = https://<project>.supabase.co/functions/v1/shopee-auth  (chính URL function này, để làm redirect)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (Supabase tự có sẵn khi deploy)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PARTNER_ID = Number(Deno.env.get("SHOPEE_PARTNER_ID"));
const PARTNER_KEY = Deno.env.get("SHOPEE_PARTNER_KEY")!;
const HOST = Deno.env.get("SHOPEE_HOST") || "https://partner.shopeemobile.com";
const SELF_URL = Deno.env.get("SELF_URL")!;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function hmac(base: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(PARTNER_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const shopId = url.searchParams.get("shop_id");
  const ts = Math.floor(Date.now() / 1000);

  // ---- CALLBACK: Shopee gọi lại với code + shop_id ----
  if (code && shopId) {
    const path = "/api/v2/auth/token/get";
    const sign = await hmac(`${PARTNER_ID}${path}${ts}`);
    const r = await fetch(`${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, shop_id: Number(shopId), partner_id: PARTNER_ID }),
    });
    const j = await r.json();
    if (!j.access_token) return new Response("Lỗi lấy token: " + JSON.stringify(j), { status: 400 });
    await sb.from("shopee_token").upsert({
      shop_id: Number(shopId),
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expire_at: new Date((ts + (j.expire_in || 14400)) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    return new Response(`✅ Ủy quyền thành công cho shop ${shopId}. Đã lưu token. Giờ có thể chạy shopee-sync.`,
      { headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  // ---- KHÔNG có code: trả về link Authorize để anh bấm ----
  const path = "/api/v2/shop/auth_partner";
  const sign = await hmac(`${PARTNER_ID}${path}${ts}`);
  const authUrl = `${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}&redirect=${encodeURIComponent(SELF_URL)}`;
  return new Response(
    `<html><body style="font-family:sans-serif;padding:40px">
       <h2>Ủy quyền Shopee cho app Data Sale</h2>
       <p>Bấm nút dưới, đăng nhập tài khoản seller và đồng ý cấp quyền:</p>
       <p><a href="${authUrl}" style="background:#ee4d2d;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Ủy quyền shop Shopee →</a></p>
     </body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } });
});
