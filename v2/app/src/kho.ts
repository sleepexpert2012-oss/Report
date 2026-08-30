/** Đọc dữ liệu từ kho Supabase.
 *
 * Luôn đọc qua KHUNG NHÌN `v2_*_hien_hanh` chứ không đọc thẳng bảng — khung
 * nhìn tự lọc theo lô đang được kích hoạt, nên đổi lô là app đổi theo, không
 * phải sửa code và không phải build lại.
 */
import type { Sku } from './types'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function doc<T>(khungNhin: string, cot = '*'): Promise<T[]> {
  if (!URL || !KEY) throw new Error('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong .env')
  const r = await fetch(`${URL}/rest/v1/${khungNhin}?select=${cot}&limit=5000`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  if (!r.ok) throw new Error(`Kho trả về ${r.status} khi đọc ${khungNhin}`)
  return r.json()
}

export type LoNap = {
  id: number
  nguon: string
  so_dong_nhan: number
  so_dong_loai: number
  nguoi_nap: string | null
  tao_luc: string
}

export const docSku = () => doc<Sku>('v2_sku_hien_hanh')

export async function docLoDangDung(): Promise<LoNap | null> {
  const r = await doc<LoNap>('v2_nap_lo', 'id,nguon,so_dong_nhan,so_dong_loai,nguoi_nap,tao_luc')
  return r.find(() => true) ?? null
}

/** Đếm số dòng của một bảng mà không tải dữ liệu về. */
export async function demDong(bang: string): Promise<number | null> {
  if (!URL || !KEY) return null
  const r = await fetch(`${URL}/rest/v1/${bang}?select=*`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact', Range: '0-0' },
  })
  const cr = r.headers.get('content-range')
  return cr ? Number(cr.split('/')[1]) : null
}

/** Toàn bộ lô nạp, mới nhất trước. */
export async function docCacLo(): Promise<(LoNap & { dang_dung: boolean })[]> {
  const r = await doc<LoNap & { dang_dung: boolean }>(
    'v2_nap_lo', 'id,nguon,so_dong_nhan,so_dong_loai,nguoi_nap,tao_luc,dang_dung')
  return r.sort((a, b) => b.id - a.id)
}

/** Snapshot của app đời trước — dùng để biết pipeline chạy lần cuối lúc nào. */
export async function docSnapshot(): Promise<{ created_at: string; bytes: number } | null> {
  const r = await doc<{ created_at: string; bytes: number }>('snapshot', 'created_at,bytes')
  return r[0] ?? null
}

export type Ncc = {
  supplier_code: string
  supplier_name: string
  lead_time_nguon: string | null
  lead_time_ngay: number | null
  moq: number | null
  payment_terms: number | null
  giao_hang: string | null
  dia_diem: string | null
  so_sku: number
}

export type DongPo = {
  stt: number
  po: string
  sku: string
  mo_ta: string | null
  supplier_code: string | null
  supplier_name: string
  don_vi: string | null
  sl_dat: number | null
  sl_xac_nhan: number | null
  gia_mua: number | null
  thanh_tien: number | null
  thanh_tien_vat: number | null
  ngay_dat: string | null
  ngay_nhan: string | null
  leadtime_nguon: number | null
  thang: number | null
  nam: number | null
  trang_thai_nhan: string | null
  ngay_hoa_don: string | null
  han_tt_ngay: number | null
  ngay_den_han: string | null
  trang_thai_tt: string | null
  so_ngay_qua_han: number | null
  da_tra: number | null
  con_no: number | null
}

export const docNcc = () => doc<Ncc>('v2_supplier_hien_hanh')
export const docPo = () => doc<DongPo>('v2_po_hien_hanh')
