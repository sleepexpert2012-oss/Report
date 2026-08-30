import { useEffect, useMemo, useState } from 'react'
import { docBanHang, docSku, docVanDe, type BanHang, type VanDe } from './kho'
import type { Sku } from './types'
import { useDemLen } from './dem'
import ThanhKy from './ThanhKy'
import { CHI_SO, khoangSS, macDinh, nhanThang, type ChiSo, type TrangThaiKy } from './ky'

/**
 * Màn Tổng quan.
 *
 * Câu hỏi màn này trả lời không phải "doanh thu bao nhiêu" mà "tiền đang chảy
 * đi đâu mất" — vì gần một nửa GMV của công ty đang bị huỷ trước khi thành đơn.
 * Vì vậy cầu nối doanh thu là phần tử chính, đặt trên cả biểu đồ theo tháng.
 *
 * Mọi con số lấy từ v2_fact_sale, đã do revenue_rules.py quyết định. Màn này
 * chỉ cộng và chia — không định nghĩa lại bất cứ khái niệm nào.
 *
 * Kỳ phân tích do `ky.ts` + `ThanhKy.tsx` lo, dùng chung cho các màn sau.
 */

const KENH: Record<string, string> = { shopee: 'TMĐT Shopee', dai_ly: 'Đại Lý', online: 'Online', b2b: 'B2B' }
const KENH_CHUA_NOI = ['dai_ly', 'online', 'b2b']
const MAU_NGANH = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)']

const tr = (v: number) => (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
const pc = (v: number) => (v * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'
const nguyen = (v: number) => Math.round(v).toLocaleString('vi-VN')

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

export type Diem = { k: string; dt: number; gmv: number; huy: number; sl: number; cogs: number }

function theoThang(rows: BanHang[]): Diem[] {
  const m = new Map<string, Diem>()
  for (const r of rows) {
    const k = (r.order_date ?? '').slice(0, 7)
    if (!k) continue
    const o = m.get(k) ?? { k, dt: 0, gmv: 0, huy: 0, sl: 0, cogs: 0 }
    o.gmv += r.gmv
    if (r.da_huy) o.huy += r.gmv
    else { o.dt += r.doanh_thu; o.sl += r.qty_thuan; o.cogs += r.cogs }
    m.set(k, o)
  }
  return [...m.values()].sort((a, b) => a.k.localeCompare(b.k))
}

/** Một điểm dữ liệu tháng quy về con số của chỉ số đang chọn. */
export function giaTri(d: Diem, c: ChiSo): number {
  if (c === 'sl') return d.sl
  if (c === 'lg') return (d.dt - d.cogs) / 1e6
  if (c === 'gm') return d.dt ? ((d.dt - d.cogs) / d.dt) * 100 : 0
  return d.dt / 1e6
}

export default function TongQuan() {
  const [ban, setBan] = useState<BanHang[] | null>(null)
  const [sku, setSku] = useState<Sku[]>([])
  const [vd, setVd] = useState<VanDe[]>([])
  const [loi, setLoi] = useState<string | null>(null)
  const [k, setK] = useState<TrangThaiKy | null>(null)

  useEffect(() => {
    Promise.all([docBanHang(), docSku(), docVanDe()])
      .then(([b, s, v]) => { setBan(b); setSku(s); setVd(v) })
      .catch((e) => setLoi(String(e.message ?? e)))
  }, [])

  const thang = useMemo(
    () => [...new Set((ban ?? []).map((r) => (r.order_date ?? '').slice(0, 7)).filter(Boolean))].sort(),
    [ban],
  )

  useEffect(() => { if (thang.length && !k) setK(macDinh(thang)) }, [thang, k])

  const { nay, truoc, soNay, soTruoc } = useMemo(() => {
    if (!ban || !thang.length || !k)
      return { nay: [] as BanHang[], truoc: [] as BanHang[], soNay: 0, soTruoc: 0 }
    const r = khoangSS(thang, k)
    const tNay = new Set(thang.slice(k.m0, k.m1 + 1))
    const tTruoc = new Set(r ? thang.slice(r[0], r[1] + 1) : [])
    const th = (x: BanHang) => (x.order_date ?? '').slice(0, 7)
    return {
      nay: ban.filter((x) => tNay.has(th(x))),
      truoc: ban.filter((x) => tTruoc.has(th(x))),
      soNay: tNay.size, soTruoc: tTruoc.size,
    }
  }, [ban, thang, k])

  const A = useMemo(() => gop(nay), [nay])
  const B = useMemo(() => gop(truoc), [truoc])
  // Hai kỳ khác độ dài thì so thẳng là sai. Quy kỳ so sánh về cùng số tháng
  // trước khi tính tăng giảm — đúng bài học rút từ app đời trước.
  const heSo = soTruoc > 0 ? soNay / soTruoc : 1

  const mNay = useMemo(() => theoThang(nay), [nay])
  // Dải trong thanh kỳ vẽ TOÀN BỘ lịch sử, không chỉ kỳ đang chọn — nếu chỉ vẽ
  // kỳ chọn thì dải luôn kín màu và chẳng nói lên điều gì.
  const chuoi = useMemo(() => {
    const m = new Map(theoThang(ban ?? []).map((d) => [d.k, d.dt]))
    return thang.map((t) => m.get(t) ?? 0)
  }, [ban, thang])

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

  const delta = (a: number, b: number) => (soTruoc > 0 && b > 0 ? a / (b * heSo) - 1 : null)
  const KPI = [
    { k: 'Doanh thu', v: tr(dtDem), u: 'triệu đồng', d: delta(A.dt, B.dt), tot: 1 },
    { k: 'Lãi gộp', v: tr(A.dt - A.cogs), u: 'triệu đồng', d: delta(A.dt - A.cogs, B.dt - B.cogs), tot: 1 },
    { k: 'Biên lợi nhuận', v: pc(gmDem), u: B.dt ? `kỳ SS ${pc((B.dt - B.cogs) / B.dt)}` : '—', d: null, tot: 1 },
    { k: 'Sản lượng', v: nguyen(A.sl), u: 'sản phẩm', d: delta(A.sl, B.sl), tot: 1 },
    { k: 'Tỷ lệ huỷ', v: pc(A.gmv ? A.huy / A.gmv : 0), u: B.gmv ? `kỳ SS ${pc(B.huy / B.gmv)}` : '—', d: null, tot: 0 },
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

      {ban && k && (
        <>
          <ThanhKy thang={thang} k={k} doi={setK} chuoi={chuoi} />

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

          <ThangChart data={mNay} chiSo={k.chiSo} />

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

          <HuyChart data={mNay} />

          <div className="tablecard">
            <div className="card-hd">
              <h2>Doanh thu theo ngành hàng</h2>
              <p className="card-sub">So kỳ chọn với kỳ so sánh · triệu đồng</p>
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

/**
 * Biểu đồ theo tháng của kỳ đang chọn, đổi theo công tắc chỉ số.
 *
 * Cố tình KHÔNG vẽ đè kỳ so sánh lên đây: hai kỳ khác độ dài mà dùng chung
 * một trục tháng thì đường thứ hai đọc ra sai. Việc "đang cắt ở đoạn nào của
 * lịch sử" đã do dải trong thanh kỳ lo.
 */
function ThangChart({ data, chiSo }: { data: Diem[]; chiSo: ChiSo }) {
  const cs = CHI_SO.find((c) => c.id === chiSo)!
  const a = data.map((d) => giaTri(d, chiSo))

  const W = 900, H = 240, pl = { l: 48, r: 16, t: 18, b: 30 }
  const iw = W - pl.l - pl.r, ih = H - pl.t - pl.b
  const max = Math.max(...a, 1)
  const bac = Math.pow(10, Math.floor(Math.log10(max)))
  const tran = chiSo === 'gm' ? 100 : Math.ceil(max / (bac * (max / bac > 5 ? 2 : 1))) * bac * (max / bac > 5 ? 2 : 1)
  const x = (i: number) => pl.l + (a.length < 2 ? iw / 2 : (i / (a.length - 1)) * iw)
  const y = (v: number) => pl.t + ih - (Math.max(0, v) / tran) * ih
  const line = a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const so = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: chiSo === 'sl' ? 0 : 1 })
  const dinh = a.length ? a.reduce((m, v, i) => (v > a[m] ? i : m), 0) : 0

  return (
    <div className="tablecard" style={{ marginBottom: 'var(--sp-4)' }}>
      <div className="card-hd">
        <h2>{cs.nhan} theo tháng</h2>
        <p className="card-sub">{cs.donVi} · ghi số ở tháng cao nhất và tháng cuối</p>
      </div>
      <div style={{ padding: 'var(--sp-4)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`${cs.nhan} theo tháng`}>
          {[0, tran / 2, tran].map((v) => (
            <g key={v}>
              <line x1={pl.l} y1={y(v)} x2={W - pl.r} y2={y(v)} stroke="var(--line)" />
              <text x={pl.l - 8} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--muted)" className="mono">
                {so(v)}
              </text>
            </g>
          ))}
          <path className="ve-vung" d={`${line} L${x(a.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
                fill="var(--accent)" opacity=".10" />
          <path className="ve-duong" d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
          {data.map((d, i) => {
            const noi = i === dinh || i === data.length - 1
            return (
              <g key={d.k}>
                <circle cx={x(i)} cy={y(a[i])} r={noi ? 4.5 : 3}
                        fill={noi ? 'var(--accent)' : 'var(--surface)'} stroke="var(--accent)" strokeWidth="2">
                  <title>{nhanThang(d.k)} · {so(a[i])} {cs.donVi}</title>
                </circle>
                {(i % 3 === 0 || i === data.length - 1) && (
                  <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="9" fill="var(--muted)" className="mono">
                    {nhanThang(d.k)}
                  </text>
                )}
                {noi && (
                  <text x={x(i)} y={y(a[i]) - 11} textAnchor={i === data.length - 1 ? 'end' : 'middle'}
                        fontSize="10.5" fontWeight="600" fill="var(--ink)" className="mono">{so(a[i])}</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function HuyChart({ data }: { data: Diem[] }) {
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
                  {nhanThang(p.k)}
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
