import { useEffect, useRef, useState } from 'react'

/** Đếm số lên khi màn mở. Tắt hẳn nếu người dùng bật chế độ giảm chuyển động. */
export function useDemLen(dich: number, batDau: boolean, ms = 450): number {
  const [v, setV] = useState(0)
  const xong = useRef(false)
  useEffect(() => {
    if (!batDau) return
    const it = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (it || xong.current) { setV(dich); xong.current = true; return }
    let raf = 0
    const t0 = performance.now()
    const buoc = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(dich * (1 - Math.pow(1 - p, 3)))     // ease-out
      if (p < 1) raf = requestAnimationFrame(buoc)
      else xong.current = true
    }
    raf = requestAnimationFrame(buoc)
    return () => cancelAnimationFrame(raf)
  }, [dich, batDau, ms])
  return v
}
