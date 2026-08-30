const vn = new Intl.NumberFormat('vi-VN')

/** Số tiền đồng. Trống thì trả về null để chỗ gọi hiện dấu gạch, không hiện "0". */
export const tien = (v: number | null | undefined): string | null =>
  v === null || v === undefined || v === 0 ? null : vn.format(Math.round(v))

export const so = (v: number | null | undefined): string | null =>
  v === null || v === undefined ? null : vn.format(v)
