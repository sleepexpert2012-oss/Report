/** Biểu tượng nét vẽ dùng chung. Không dùng emoji — emoji đổi hình theo hệ điều hành. */
const P: Record<string, string> = {
  master: 'M3 4h18v16H3zM3 9.5h18M9 9.5V20',
  ncc: 'M3 7h11v9H3zM14 10.5h3.6L21 14v2h-7',
  mua: 'M2.5 3.5h2.7l2.5 11.5h10.6L21 7.4H6.2',
  tongquan: 'M3 3v18h18M7 15.5l4-5 3 3 5-7',
  nganh: 'M12 3l9 4.8-9 4.8-9-4.8zM3 12.4l9 4.8 9-4.8',
  pl: 'M2.5 6h19v12h-19zM6 12h.6M17.4 12h.6',
  ton: 'M20.5 8L12 3.4 3.5 8v8L12 20.6 20.5 16zM3.5 8L12 12.6 20.5 8',
  hatang: 'M4 5.5h16v4H4zM4 14.5h16v4H4zM7.5 7.5h.01M7.5 16.5h.01',
}

/** Vòng tròn phụ cho vài biểu tượng — path không vẽ được. */
const EXTRA: Record<string, Array<[number, number, number]>> = {
  ncc: [[7, 18.4, 1.5], [17.4, 18.4, 1.5]],
  mua: [[9.5, 19.5, 1.5], [17.5, 19.5, 1.5]],
  pl: [[12, 12, 2.6]],
}

export function Icon({ ten, sz = 17 }: { ten: string; sz?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={sz} height={sz} fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[ten]} />
      {(EXTRA[ten] ?? []).map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} />)}
    </svg>
  )
}
