/** Một dòng trong danh mục SKU, đúng theo hợp đồng v2/contracts/sku-master.yaml. */
export type Sku = {
  ma_san_pham: string | null
  sku: string
  category: string | null
  nganh_hang: string | null
  supplier_code: string | null
  supplier_name: string | null
  brand: string | null
  subcategory_code: string | null
  subcategory_name: string | null
  shopee_item_id: string | null
  variation_code: string | null
  variation_name: string | null
  ten_san_pham: string | null
  vat_lieu_chinh: string | null
  cao: string | null
  rong: number | null
  dai: number | null
  net_weight: number | null
  gross_weight: number | null
  dong_goi: string | null
  mau: string | null
  min_order: number | null
  leadtime: number | null
  unit_cost_usd: number | null
  unit_cost_vnd: number | null
  gia_von_vat: number | null
  sales_price_vnd: number | null
  abc_class: string | null
  m3: number | null
}

export const coGiaTri = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== '' && v !== 0

/**
 * Sáu trường quyết định một SKU đã khai báo xong hay chưa.
 *
 * Giá vốn dùng đúng quy tắc của docs/QUY-TAC-DOANH-THU.md: `Unit Cost (VND)` là
 * nguồn ưu tiên, `Giá vốn (+VAT)` là nguồn dự phòng — có một trong hai là đủ.
 */
export const TRUONG_HOAN_THIEN: ReadonlyArray<{ id: string; nhan: string; co: (r: Sku) => boolean }> = [
  { id: 'gia_von', nhan: 'Giá vốn', co: (r) => coGiaTri(r.unit_cost_vnd) || coGiaTri(r.gia_von_vat) },
  { id: 'gia_ban', nhan: 'Giá bán', co: (r) => coGiaTri(r.sales_price_vnd) },
  { id: 'leadtime', nhan: 'Lead time', co: (r) => coGiaTri(r.leadtime) },
  { id: 'moq', nhan: 'MOQ', co: (r) => coGiaTri(r.min_order) },
  { id: 'abc', nhan: 'ABC', co: (r) => coGiaTri(r.abc_class) },
  { id: 'shopee', nhan: 'ID Shopee', co: (r) => coGiaTri(r.shopee_item_id) },
]

export const demHoanThien = (r: Sku): number =>
  TRUONG_HOAN_THIEN.filter((f) => f.co(r)).length
