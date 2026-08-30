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
