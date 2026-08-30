import { useEffect, useMemo, useState } from 'react'
import { docBanHang, docSku, docVanDe, type BanHang, type Sku, type VanDe } from './kho'
import { useDemLen } from './dem'

/**
 * Màn Tổng quan.
 *
 * Câu hỏi màn này trả lời không phải "doanh thu bao nhiêu" mà "tiền đang chảy
 * đi đâu mất" — vì gần một nửa GMV của công ty đang bị huỷ trước khi thành đơn.
 * Vì vậy cầu nối doanh thu là phần tử chính, đặt trên cả biểu đồ theo tháng.
 *
 * Mọi con số lấy từ v2_fact_sale, đã do revenue_rules.py quyết định. Màn này
 * chỉ cộng và chia — không định nghĩa lại bất cứ khái niệm nào.
 */

const KENH: Record<string, string> = { shopee: 'TMĐT Shopee', dai_ly: 'Đại Lý', online: 'Online', b2b: 'B2B' }
const KENH_CHUA_NOI = ['dai_ly', 'online', 'b2b']
const MAU_NGANH = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)']

const tr = (v: number) => (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
const pc = (v: number) => (v * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'
const nguyen = (v: number) => Math.round(v).toLocaleString('vi-VN')

type Ky = { nhan: string; thang: number | null }
const KY: Ky[] = [
  { nhan: '3 tháng', thang: 3 }, { nhan: '6 tháng', thang: 6 },
  { nhan: '12 tháng', thang: 12 }, { nhan: 'Toàn kỳ', thang: null },
]

type Tong = { gmv: number; huy: number; giam: number; hoan: number; dt: number; cogs: number; sl: number; don: number; ma: number }
const rong = (): Tong => ({ gmv: 0, huy: 0, giam: 0, hoan: 0, dt: 0, cogs: 0, sl: 0, don: 0, ma: 0 })

function gop(rows: BanHang[]): Tong {
  const t = rong()
  const don = new Set<string>(), ma = new Set<string>()
  for (const r of rows) {
    t.gmv += r.gmv
    if (r.da_huy) t.huy += r.gmv
    else {
      t.giam += r.giam_gia; t.hoan += r.gia_tri_hoan
      t.dt += r.doanh_thu; t.cogs += r.cogs; t.sl += r.qty_thuan
      if (r.doanh_thu > 0) { don.add(r.order_id); if (r.sku) ma.add(r.sku) }
    }
  }
  t.don = don.size; t.ma = ma.size
  return t
}

export default function TongQuan() {
  const [ban, setBan] = useState<BanHang[] | null>(null)
  const [sku, setSku] = useState<Sku[]>([])
  const [vd, setVd] = useState<VanDe[]>([])
  const [loi, setLoi] = useState<string | null>(null)
  const [ky, setKy] = useState<number | null>(12)

  useEffect(() => {
    Promise.all([docBanHang(), docSku(), docVanDe()])
      .then(([b, s, v]) => { setBan(b); setSku(s); setVd(v) })
      .catch((e) => setLoi(String(e.message ?? e)))
  }, [])

  const thang = useMemo(
    () => [...new Set((ban ?? []).map((r) => (r.order_date ?? '').slice(0, 7)).filter(Boolean))].sort(),
    [ban],
  )

  const { nay, truoc, nhanKy, nhanSS, soNay, soTruoc } = useMemo(() => {
    if (!ban || !thang.length)
      return { nay: [] as BanHang[], truoc: [] as BanHang[], nhanKy: '', nhanSS: '', soNay: 0, soTruoc: 0 }
    const n = ky ?? thang.length
    const tNay = thang.slice(-n)
    const tTruoc = thang.slice(Math.max(0, thang.length - 2 * n), thang.length - n)
    const trong = (r: BanHang, ds: string[]) => ds.includes((r.order_date ?? '').slice(0, 7))
    const nh = (ds: string[]) => (ds.length ? `${ds[0].replace('-', '/')} – ${ds[ds.length - 1].replace('-', '/')}` : '—')
    return {
      nay: ban.filter((r) => trong(r, tNay)),
      truoc: ban.filter((r) => trong(r, tTruoc)),
      nhanKy: nh(tNay), nhanSS: tTruoc.length ? nh(tTruoc) : 'không đủ dữ liệu',
      soNay: tNay.length, soTruoc: tTruoc.length,
    }
  }, [ban, thang, ky])

  const A = useMemo(() => gop(nay), [nay])
  const B = useMemo(() => gop(truoc), [truoc])
  const lechDoDai = soTruoc > 0 && soNay !== soTruoc
  // Hai kỳ khác độ dài thì so thẳng là sai. Quy kỳ so sánh về cùng số tháng
  // trước khi tính tăng giảm — đúng bài học rút từ app đời trước.
  const heSo = soTruoc > 0 ? soNay / soTruoc : 1

  const theoThang = useMemo(() => {
    const m = new Map<string, { dt: number; gmv: number; huy: number }>()
    for (const r of nay) {
      const k = (r.order_date ?? '').slice(0, 7)
      if (!k) continue
      const o = m.get(k) ?? { dt: 0, gmv: 0, huy: 0 }
      o.gmv += r.gmv
      if (r.da_huy) o.huy += r.gmv; else o.dt += r.doanh_thu
      m.set(k, o)
    }
    return [...m.entries()].sort().map(([k, v]) => ({ k, ...v }))
  }, [nay])

  const tenSku = useMemo(() => Object.fromEntries(sku.map((s) => [s.sku, s])), [sku])

  const nganh = useMemo(() => {
    const m = new Map<string, { dt: number; cogs: number; sl: number }>()
    const gomKy = (rows: BanHang[]) => {
      const x = new Map<string, number>()
      for (const r of rows) {
        if (r.da_huy || !r.sku) continue
        const n = tenSku[r.sku]?.nganh_hang ?? '(chưa khai báo)'
        x.set(n, (x.get(n) ?? 0) + r.doanh_thu)
      }
      return x
    }
    for (const r of nay) {
      if (r.da_huy || !r.sku) continue
      const n = tenSku[r.sku]?.nganh_hang ?? '(chưa khai báo)'
      const o = m.get(n) ?? { dt: 0, cogs: 0, sl: 0 }
      o.dt += r.doanh_thu; o.cogs += r.cogs; o.sl += r.qty_thuan
      m.set(n, o)
    }
    const cu = gomKy(truoc)
    return [...m.entries()]
      .map(([ten, v]) => ({ ten, ...v, cu: cu.get(ten) ?? 0 }))
      .sort((a, b) => b.dt - a.dt)
  }, [nay, truoc, tenSku])

  const top10 = useMemo(() => {
    const m = new Map<string, { dt: number; cogs: number; sl: number }>()
    for (const r of nay) {
      if (r.da_huy || !r.sku) continue
      const o = m.get(r.sku) ?? { dt: 0, cogs: 0, sl: 0 }
      o.dt += r.doanh_thu; o.cogs += r.cogs; o.sl += r.qty_thuan
      m.set(r.sku, o)
    }
    const tong = [...m.values()].reduce((s, v) => s + v.dt, 0)
    return {
      ds: [...m.entries()].map(([s, v]) => ({ sku: s, ...v })).sort((a, b) => b.dt - a.dt).slice(0, 10),
      tong, soMa: m.size,
    }
  }, [nay])

  const kenh = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of nay) if (!r.da_huy) m.set(r.channel, (m.get(r.channel) ?? 0) + r.doanh_thu)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [nay])

  const sanSang = !!ban
  const dtDem = useDemLen(A.dt, sanSang)
  const gmDem = useDemLen(A.dt ? (A.dt - A.cogs) / A.dt : 0, sanSang)

  const delta = (a: number, b: number) => (b > 0 ? a / (b * heSo) - 1 : null)
  const KPI = [
    { k: 'Doanh thu', v: tr(dtDem), u: 'triệu đồng', d: delta(A.dt, B.dt), tot: 1 },
    { k: 'Lãi gộp', v: tr(A.dt - A.cogs), u: 'triệu đồng', d: delta(A.dt - A.cogs, B.dt - B.cogs), tot: 1 },
    { k: 'Biên lợi nhuận', v: pc(gmDem), u: B.dt ? `kỳ trước ${pc((B.dt - B.cogs) / B.dt)}` : '—', d: null, tot: 1 },
    { k: 'Sản lượng', v: nguyen(A.sl), u: 'sản phẩm', d: delta(A.sl, B.sl), tot: 1 },
    { k: 'Tỷ lệ huỷ', v: pc(A.gmv ? A.huy / A.gmv : 0), u: B.gmv ? `kỳ trước ${pc(B.huy / B.gmv)}` : '—', d: null, tot: 0 },
    { k: 'Mã có bán', v: nguyen(A.ma), u: `trên ${sku.length} mã danh mục`, d: null, tot: 1 },
  ]

  const cau = [
    { ten: 'GMV', v: A.gmv, mau: 'var(--accent)', ghi: 'tổng giá trị đơn đặt' },
    { ten: 'Đơn huỷ', v: -A.huy, mau: 'var(--crit)', ghi: A.gmv ? pc(A.huy / A.gmv) + ' GMV' : '' },
    { ten: 'Giảm giá', v: -A.giam, mau: 'var(--warn)', ghi: A.gmv ? pc(A.giam / A.gmv) + ' GMV' : '' },
    { ten: 'Hoàn trả', v: -A.hoan, mau: 'var(--muted)', ghi: A.hoan ? '' : 'Shopee chưa trả số lượng hoàn' },
    { ten: 'Doanh thu', v: A.dt, mau: 'var(--good)', ghi: A.gmv ? pc(A.dt / A.gmv) + ' GMV' : '' },
  ]
  const maxCau = Math.max(...cau.map((c) => Math.abs(c.v)), 1)

  return (
    <>
      <div className="eyebrow">Bán hàng</div>
      <h1>Tổng quan</h1>
      <p className="sub">
        Mọi con số trên màn lấy từ bảng sự kiện bán hàng, đã do <code>revenue_rules.py</code> quyết định —
        cùng một công thức với màn Tài chính, nên hai màn không thể ra hai kết quả.
      </p>

      {loi && <div className="state"><b>Không đọc được kho</b>{loi}</div>}
      {!ban && !loi && <div className="state">Đang đọc dữ liệu bán hàng…</div>}

      {ban && (
        <>
          <div className="filters" style={{ marginTop: 'var(--sp-5)' }}>
            <div className="field">
              <label>Kỳ phân tích</label>
              <div className="presets">
                {KY.map((k) => (
                  <button key={k.nhan} className={ky === k.thang ? 'on' : ''} onClick={() => setKy(k.thang)}>
                    {k.nhan}
                  </button>
                ))}
              </div>
            </div>
            <div className="ky-txt">
              Kỳ chọn <b>{nhanKy}</b> · so với <b>{nhanSS}</b>
              {lechDoDai && (
                <span className="lech">
                  {' '}⚠ kỳ so sánh chỉ có {soTruoc} tháng, đã quy về bình quân {soNay} tháng để so cho công bằng
                </span>
              )}
            </div>
          </div>

          <div className="stats">
            {KPI.map((x) => (
              <div className="stat" key={x.k}>
                <span className="v">{x.v}</span>
                <span className="k">{x.k}</span>
                <span className="k" style={{ marginTop: 2 }}>{x.u}</span>
                {x.d !== null && (
                  <span className="delta" style={{ color: (x.d >= 0) === !!x.tot ? 'var(--good)' : 'var(--crit)' }}>
                    {x.d >= 0 ? '▲ +' : '▼ '}{pc(Math.abs(x.d))}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* ── phần tử chính của màn ── */}
          <div className="tablecard hero" style={{ marginBottom: 'var(--sp-4)' }}>
            <div className="card-hd">
              <h2>Tiền chảy đi đâu</h2>
              <p className="card-sub">Từ tổng giá trị đơn đặt xuống doanh thu thật · triệu đồng, chưa VAT</p>
            </div>
            <div className="cau">
              {cau.map((c, i) => (
                <div className="cau-dong" key={c.ten} style={{ ['--i' as string]: i }}>
                  <span className="cau-ten">{c.ten}</span>
                  <span className="cau-thanh">
                    <i style={{ width: `${(Math.abs(c.v) / maxCau) * 100}%`, background: c.mau }} />
                  </span>
                  <span className="cau-so mono" style={{ color: c.v < 0 ? 'var(--crit)' : 'var(--ink)' }}>
                    {c.ten === 'Hoàn trả' && !A.hoan
                      ? <span className="empty-val">—</span>
                      : <>{c.v < 0 ? '−' : ''}{tr(Math.abs(c.v))}</>}
                  </span>
                  <span className="cau-ghi">{c.ghi}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hai-cot" style={{ marginBottom: 'var(--sp-4)' }}>
            <div className="tablecard">
              <div className="card-hd"><h2>Kênh bán</h2><p className="card-sub">Doanh thu theo kênh</p></div>
              <div className="khoi">
                {kenh.map(([c, v]) => (
                  <div className="doi" key={c}>
                    <span className="doi-k">{KENH[c] ?? c}</span>
                    <span className="doi-v">
                      <span className="dai"><i style={{ width: `${(v / (A.dt || 1)) * 100}%` }} /></span>
                      <b className="mono"> {pc(v / (A.dt || 1))}</b> · {tr(v)} tr
                    </span>
                  </div>
                ))}
                <p className="khoi-note">
                  Chưa nối: {KENH_CHUA_NOI.map((c) => KENH[c]).join(' · ')}. Bảng sự kiện đã có sẵn cột kênh
                  nên khi dữ liệu về, dải này tự tách — không phải sửa màn hình.
                </p>
              </div>
            </div>

            <div className="tablecard">
              <div className="card-hd"><h2>Cơ cấu ngành hàng</h2><p className="card-sub">Tỷ trọng doanh thu kỳ chọn</p></div>
              <div className="khoi">
                <div className="xepchong">
                  {nganh.map((n, i) => (
                    <i key={n.ten} style={{ width: `${(n.dt / (A.dt || 1)) * 100}%`, background: MAU_NGANH[i % 5] }}>
                      <title>{n.ten} · {pc(n.dt / (A.dt || 1))}</title>
                    </i>
                  ))}
                </div>
                <div className="chugiai">
                  {nganh.map((n, i) => (
                    <span key={n.ten}><i style={{ background: MAU_NGANH[i % 5] }} />{n.ten} <b>{pc(n.dt / (A.dt || 1))}</b></span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <ThangChart data={theoThang} />

          <div className="tablecard" style={{ marginBottom: 'var(--sp-4)' }}>
            <div className="card-hd">
              <h2>Mười mã bán chạy nhất</h2>
              <p className="card-sub">
                Doanh thu · sản lượng · biên lợi nhuận từng mã — chiếm{' '}
                <b>{pc(top10.ds.reduce((s, x) => s + x.dt, 0) / (top10.tong || 1))}</b> doanh thu
                {' '}trong {top10.soMa} mã có bán
              </p>
            </div>
            <div className="top10">
              {top10.ds.map((x, i) => {
                const m = tenSku[x.sku]
                const nh = m?.nganh_hang ?? '(chưa khai báo)'
                const idx = nganh.findIndex((n) => n.ten === nh)
                const gm = x.dt ? (x.dt - x.cogs) / x.dt : 0
                return (
                  <div className="t10" key={x.sku} style={{ ['--i' as string]: i }}>
                    <span className="t10-h mono">{i + 1}</span>
                    <span className="t10-ten">
                      <span className="mono">{x.sku}</span>{' '}
                      <span className="dim">{(m?.ten_san_pham ?? '(chưa có trong danh mục)').slice(0, 44)}</span>
                    </span>
                    <span className="t10-thanh">
                      <i style={{ width: `${(x.dt / (top10.ds[0]?.dt || 1)) * 100}%`,
                                  background: MAU_NGANH[(idx < 0 ? 4 : idx) % 5] }}>
                        <title>{x.sku} · {tr(x.dt)} triệu · {nguyen(x.sl)} cái · GM {pc(gm)}</title>
                      </i>
                    </span>
                    <span className="t10-so mono">{tr(x.dt)}</span>
                    <span className="t10-sl mono dim">{nguyen(x.sl)} cái</span>
                    <span className="t10-gm mono" style={{ color: gm < 0.22 ? 'var(--warn)' : 'var(--ink-soft)' }}>
                      GM {pc(gm)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <HuyChart data={theoThang} />

          <div className="tablecard">
            <div className="card-hd">
              <h2>Doanh thu theo ngành hàng</h2>
              <p className="card-sub">So kỳ chọn với kỳ trước · triệu đồng</p>
            </div>
            <div className="tscroll" style={{ maxHeight: 'none' }}>
              <table>
                <thead>
                  <tr>{['Ngành hàng', 'Kỳ SS', 'Kỳ chọn', 'Δ', '%Δ', 'GM%', 'Sản lượng', 'Tỷ trọng']
                    .map((h, i) => <th key={h} className={i ? 'num' : ''} style={{ cursor: 'default' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {nganh.map((n) => {
                    const d = n.dt - n.cu
                    const p = n.cu > 0 ? d / n.cu : null
                    return (
                      <tr key={n.ten}>
                        <td>{n.ten}</td>
                        <td className="num mono">{n.cu ? tr(n.cu) : <span className="empty-val">—</span>}</td>
                        <td className="num mono">{tr(n.dt)}</td>
                        <td className="num mono" style={{ color: d >= 0 ? 'var(--good)' : 'var(--crit)' }}>
                          {d >= 0 ? '+' : '−'}{tr(Math.abs(d))}
                        </td>
                        <td className="num mono" style={{ color: (p ?? 0) >= 0 ? 'var(--good)' : 'var(--crit)' }}>
                          {p === null ? <span className="pill">Mới</span> : (p >= 0 ? '+' : '−') + pc(Math.abs(p))}
                        </td>
                        <td className="num mono">{n.dt ? pc((n.dt - n.cogs) / n.dt) : <span className="empty-val">—</span>}</td>
                        <td className="num mono">{nguyen(n.sl)}</td>
                        <td className="num mono">{pc(n.dt / (A.dt || 1))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {vd.filter((v) => v.trang_thai === 'mo').length > 0 && (
            <div className="tablecard canh-bao" style={{ marginTop: 'var(--sp-4)' }}>
              <div className="card-hd">
                <h2>Số liệu này còn khuyết chỗ nào</h2>
                <p className="card-sub">Đọc từ sổ vấn đề dữ liệu, không phải chữ gõ tay</p>
              </div>
              <div className="khoi">
                <div className="doi">
                  <span className="doi-k">Mã thiếu danh mục</span>
                  <span className="doi-v">
                    <b>{vd.filter((v) => v.trang_thai === 'mo').length}</b> mã bán ra không có trong danh mục SKU,
                    tổng <b>{tr(vd.reduce((s, v) => s + (v.gmv_treo ?? 0), 0))} triệu</b> doanh thu.
                    Giá vốn của chúng đang tính bằng 0 nên <b>biên lợi nhuận đang cao hơn thực tế một chút</b>.
                    Bổ sung vào master là hết.
                  </span>
                </div>
                <div className="doi">
                  <span className="doi-k">Hoàn trả</span>
                  <span className="doi-v">
                    Shopee API chưa trả số lượng hoàn thực tế nên dòng hoàn trả bằng 0 —
                    <b> chưa có dữ liệu, không phải không có hàng hoàn</b>.
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

/* ---------- biểu đồ ---------- */

function ThangChart({ data }: { data: { k: string; dt: number }[] }) {
  const W = 900, H = 240, pl = { l: 46, r: 16, t: 18, b: 26 }
  const iw = W - pl.l - pl.r, ih = H - pl.t - pl.b
  const max = Math.max(...data.map((d) => d.dt / 1e6), 1)
  const buoc = Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 2 : 1)
  const tran = Math.ceil(max / buoc) * buoc
  const x = (i: number) => pl.l + (data.length < 2 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v: number) => pl.t + ih - (v / tran) * ih
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.dt / 1e6).toFixed(1)}`).join(' ')
  const dinh = data.reduce((a, d, i) => (d.dt > data[a].dt ? i : a), 0)
  return (
    <div className="tablecard" style={{ marginBottom: 'var(--sp-4)' }}>
      <div className="card-hd"><h2>Doanh thu theo tháng</h2><p className="card-sub">Triệu đồng · ghi số ở tháng cao nhất và tháng cuối</p></div>
      <div style={{ padding: 'var(--sp-4)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Doanh thu theo tháng">
          {[0, tran / 2, tran].map((v) => (
            <g key={v}>
              <line x1={pl.l} y1={y(v)} x2={W - pl.r} y2={y(v)} stroke="var(--line)" />
              <text x={pl.l - 8} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--muted)" className="mono">{v}</text>
            </g>
          ))}
          <path className="ve-vung" d={`${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="var(--accent)" opacity=".10" />
          <path className="ve-duong" d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
          {data.map((d, i) => (
            <g key={d.k}>
              <circle cx={x(i)} cy={y(d.dt / 1e6)} r={i === dinh || i === data.length - 1 ? 4.5 : 3}
                      fill={i === dinh || i === data.length - 1 ? 'var(--accent)' : 'var(--surface)'}
                      stroke="var(--accent)" strokeWidth="2">
                <title>{d.k} · {tr(d.dt)} triệu</title>
              </circle>
              {(i % 3 === 0 || i === data.length - 1) && (
                <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--muted)" className="mono">
                  {d.k.slice(2).replace('-', '/')}
                </text>
              )}
              {(i === dinh || i === data.length - 1) && (
                <text x={x(i)} y={y(d.dt / 1e6) - 11} textAnchor={i === data.length - 1 ? 'end' : 'middle'}
                      fontSize="10.5" fontWeight="600" fill="var(--ink)" className="mono">{tr(d.dt)}</text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

function HuyChart({ data }: { data: { k: string; gmv: number; huy: number }[] }) {
  const d = data.map((x) => ({ k: x.k, v: x.gmv ? (x.huy / x.gmv) * 100 : 0 }))
  const W = 900, H = 190, pl = { l: 40, r: 16, t: 16, b: 26 }
  const iw = W - pl.l - pl.r, ih = H - pl.t - pl.b
  const x = (i: number) => pl.l + (d.length < 2 ? iw / 2 : (i / (d.length - 1)) * iw)
  const y = (v: number) => pl.t + ih - (v / 100) * ih
  const cuoi = d[d.length - 1]
  return (
    <div className="tablecard" style={{ marginBottom: 'var(--sp-4)' }}>
      <div className="card-hd"><h2>Tỷ lệ huỷ đơn theo tháng</h2><p className="card-sub">Phần trăm GMV bị huỷ · nét đứt là mốc 50%</p></div>
      <div style={{ padding: 'var(--sp-4)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Tỷ lệ huỷ đơn theo tháng">
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={pl.l} y1={y(v)} x2={W - pl.r} y2={y(v)} stroke="var(--line)"
                    strokeDasharray={v === 50 ? '4 4' : undefined} />
              <text x={pl.l - 7} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--muted)" className="mono">{v}%</text>
            </g>
          ))}
          <path className="ve-duong" d={d.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}
                fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
          {d.map((p, i) => (
            <g key={p.k}>
              <circle cx={x(i)} cy={y(p.v)} r={i === d.length - 1 ? 4.5 : 2.6}
                      fill={i === d.length - 1 ? 'var(--crit)' : 'var(--surface)'}
                      stroke={i === d.length - 1 ? 'var(--crit)' : 'var(--ink)'} strokeWidth="1.6">
                <title>{p.k} · {p.v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% GMV bị huỷ</title>
              </circle>
              {(i % 3 === 0 || i === d.length - 1) && (
                <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--muted)" className="mono">
                  {p.k.slice(2).replace('-', '/')}
                </text>
              )}
            </g>
          ))}
          {cuoi && (
            <text x={x(d.length - 1)} y={y(cuoi.v) - 12} textAnchor="end" fontSize="11" fontWeight="700"
                  fill="var(--crit)" className="mono">
              {cuoi.v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%
            </text>
          )}
        </svg>
      </div>
    </div>
  )
}
