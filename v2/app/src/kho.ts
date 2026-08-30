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
