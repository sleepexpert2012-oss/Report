/**
 * Logic chọn kỳ phân tích — tách khỏi giao diện để test được và để mọi màn
 * dùng chung một cách hiểu về "kỳ".
 *
 * Dựng lại đầy đủ theo app đời trước, gồm cả những thứ dễ bị bỏ quên:
 * preset YTD và FY, chọn tay từ tháng đến tháng, bốn kiểu so sánh, và công
 * tắc đổi chỉ số áp cho mọi biểu đồ.
 */

export type KieuSS = 'prev' | 'yoy' | 'custom' | 'none'
export type ChiSo = 'dt' | 'sl' | 'lg' | 'gm'

export type TrangThaiKy = {
  m0: number; m1: number      // chỉ số tháng trong mảng `thang`
  ss: KieuSS
  c0: number; c1: number      // kỳ so sánh khi tự chọn
  chiSo: ChiSo
}

export const CHI_SO: { id: ChiSo; nhan: string; donVi: string }[] = [
  { id: 'dt', nhan: 'Doanh thu', donVi: 'triệu đồng' },
  { id: 'sl', nhan: 'Sản lượng', donVi: 'sản phẩm' },
  { id: 'lg', nhan: 'Lãi gộp', donVi: 'triệu đồng' },
  { id: 'gm', nhan: 'GM%', donVi: '%' },
]

export const SS: { id: KieuSS; nhan: string }[] = [
  { id: 'prev', nhan: 'Kỳ liền trước' },
  { id: 'yoy', nhan: 'Cùng kỳ năm trước' },
  { id: 'custom', nhan: 'Tự chọn' },
  { id: 'none', nhan: 'Không so sánh' },
]

/** "2026-08" → "T8/26" */
export const nhanThang = (t: string) => `T${Number(t.slice(5, 7))}/${t.slice(2, 4)}`

export function macDinh(thang: string[]): TrangThaiKy {
  const n = thang.length
  const m0 = Math.max(0, n - 12)
  return { m0, m1: n - 1, ss: 'prev', c0: Math.max(0, m0 - 12), c1: Math.max(0, m0 - 1), chiSo: 'dt' }
}

export type Preset = { id: string; nhan: string; tinh: (thang: string[]) => [number, number] | null }

export const PRESET: Preset[] = [
  { id: '3', nhan: '3T', tinh: (t) => [Math.max(0, t.length - 3), t.length - 1] },
  { id: '6', nhan: '6T', tinh: (t) => [Math.max(0, t.length - 6), t.length - 1] },
  { id: '12', nhan: '12T', tinh: (t) => [Math.max(0, t.length - 12), t.length - 1] },
  {
    id: 'ytd', nhan: 'YTD',
    tinh: (t) => {
      if (!t.length) return null
      const nam = t[t.length - 1].slice(0, 4)
      const i = t.findIndex((x) => x.slice(0, 4) === nam)
      return i < 0 ? null : [i, t.length - 1]
    },
  },
  {
    id: 'fy25', nhan: 'FY2025',
    tinh: (t) => {
      const ds = t.map((x, i) => [x, i] as const).filter(([x]) => x.slice(0, 4) === '2025')
      return ds.length ? [ds[0][1], ds[ds.length - 1][1]] : null
    },
  },
  { id: 'all', nhan: 'Toàn kỳ', tinh: (t) => (t.length ? [0, t.length - 1] : null) },
]

/** Preset nào đang khớp đúng khoảng đang chọn (để tô sáng nút). */
export function presetDangChon(thang: string[], k: TrangThaiKy): string | null {
  for (const p of PRESET) {
    const r = p.tinh(thang)
    if (r && r[0] === k.m0 && r[1] === k.m1) return p.id
  }
  return null
}

/** Khoảng tháng của kỳ so sánh. Trả [] nếu không so sánh hoặc không đủ dữ liệu. */
export function khoangSS(thang: string[], k: TrangThaiKy): [number, number] | null {
  const dai = k.m1 - k.m0 + 1
  if (k.ss === 'none') return null
  if (k.ss === 'custom') return k.c0 <= k.c1 ? [k.c0, k.c1] : null
  if (k.ss === 'prev') {
    const b = k.m0 - dai
    return k.m0 - 1 < 0 ? null : [Math.max(0, b), k.m0 - 1]
  }
  // cùng kỳ năm trước: lùi đúng 12 tháng theo NHÃN tháng, không lùi theo vị trí,
  // vì dữ liệu có thể khuyết tháng nào đó ở giữa.
  const lui = (i: number) => {
    const t = thang[i]
    const muc = `${Number(t.slice(0, 4)) - 1}-${t.slice(5, 7)}`
    return thang.indexOf(muc)
  }
  const a = lui(k.m0), b = lui(k.m1)
  return a >= 0 && b >= 0 && a <= b ? [a, b] : null
}

export function nhanKhoang(thang: string[], r: [number, number] | null): string {
  if (!r || !thang.length) return '—'
  return r[0] === r[1] ? nhanThang(thang[r[0]]) : `${nhanThang(thang[r[0]])} – ${nhanThang(thang[r[1]])}`
}
