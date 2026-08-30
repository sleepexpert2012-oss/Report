import { useEffect, useMemo, useState } from 'react'
import { TRUONG_HOAN_THIEN, coGiaTri, demHoanThien, type Sku } from './types'
import { so, tien } from './format'
import { Icon } from './icons'

type Cot = {
  key: keyof Sku | 'hoan_thien'
  nhan: string
  num?: boolean
  render: (r: Sku) => React.ReactNode
  sortVal: (r: Sku) => string | number
}

const trong = <span className="empty-val">—</span>

const COT: Cot[] = [
  {
    key: 'sku',
    nhan: 'SKU',
    render: (r) => <span className="mono">{r.sku}</span>,
    sortVal: (r) => r.sku,
  },
  {
    key: 'ten_san_pham',
    nhan: 'Tên sản phẩm',
    render: (r) => (
      <div className="name" title={r.ten_san_pham ?? ''}>
        {r.ten_san_pham ?? trong}
      </div>
    ),
    sortVal: (r) => r.ten_san_pham ?? '',
  },
  {
    key: 'nganh_hang',
    nhan: 'Ngành hàng',
    render: (r) => r.nganh_hang ?? trong,
    sortVal: (r) => r.nganh_hang ?? '',
  },
  {
    key: 'brand',
    nhan: 'Brand',
    render: (r) => (
      <span className={'pill' + (r.brand === 'POWER X' ? ' brand-px' : '')}>{r.brand}</span>
    ),
    sortVal: (r) => r.brand ?? '',
  },
  {
    key: 'supplier_name',
    nhan: 'Nhà cung cấp',
    render: (r) => (
      <span title={r.supplier_code ?? ''}>{r.supplier_name ?? trong}</span>
    ),
    sortVal: (r) => r.supplier_name ?? '',
  },
  {
    key: 'unit_cost_vnd',
    nhan: 'Giá vốn',
    num: true,
    render: (r) => <span className="mono">{tien(r.unit_cost_vnd) ?? trong}</span>,
    sortVal: (r) => r.unit_cost_vnd ?? -1,
  },
  {
    key: 'sales_price_vnd',
    nhan: 'Giá bán',
    num: true,
    render: (r) => <span className="mono">{tien(r.sales_price_vnd) ?? trong}</span>,
    sortVal: (r) => r.sales_price_vnd ?? -1,
  },
  {
    key: 'min_order',
    nhan: 'MOQ',
    num: true,
    render: (r) => <span className="mono">{so(r.min_order) ?? trong}</span>,
    sortVal: (r) => r.min_order ?? -1,
  },
  {
    key: 'leadtime',
    nhan: 'Lead time',
    num: true,
    render: (r) => <span className="mono">{so(r.leadtime) ?? trong}</span>,
    sortVal: (r) => r.leadtime ?? -1,
  },
  {
    key: 'abc_class',
    nhan: 'ABC',
    render: (r) => r.abc_class ?? trong,
    sortVal: (r) => r.abc_class ?? '',
  },
  {
    key: 'hoan_thien',
    nhan: 'Hoàn thiện',
    render: (r) => (
      <span
        className="ribbon"
        title={TRUONG_HOAN_THIEN.map((f) => `${f.co(r) ? '✓' : '—'} ${f.nhan}`).join('\n')}
      >
        {TRUONG_HOAN_THIEN.map((f) => (
          <i key={f.id} className={f.co(r) ? '' : 'off'} />
        ))}
      </span>
    ),
    sortVal: (r) => demHoanThien(r),
  },
]

const MAN_HINH = [
  { nhom: 'Dữ liệu', muc: [
    { ic: 'master', ten: 'Master Data', xong: true },
    { ic: 'ncc', ten: 'Nhà cung cấp', xong: false },
    { ic: 'mua', ten: 'Mua hàng', xong: false }] },
  { nhom: 'Bán hàng', muc: [
    { ic: 'tongquan', ten: 'Tổng quan', xong: false },
    { ic: 'nganh', ten: 'Ngành & Brand', xong: false },
    { ic: 'pl', ten: 'Tài chính P&L', xong: false }] },
  { nhom: 'Vận hành', muc: [
    { ic: 'ton', ten: 'Tồn kho', xong: false }] },
]

export default function App() {
  const [rows, setRows] = useState<Sku[] | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [nganh, setNganh] = useState('')
  const [brand, setBrand] = useState('')
  const [ncc, setNcc] = useState('')
  const [thieu, setThieu] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'sku', dir: 1 })

  useEffect(() => {
    fetch('/data/master-sku.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Máy chủ trả về ${r.status}`)
        return r.json()
      })
      .then(setRows)
      .catch((e) => setLoi(String(e.message ?? e)))
  }, [])

  const dsNganh = useMemo(() => [...new Set((rows ?? []).map((r) => r.nganh_hang).filter(Boolean))].sort() as string[], [rows])
  const dsBrand = useMemo(() => [...new Set((rows ?? []).map((r) => r.brand).filter(Boolean))].sort() as string[], [rows])
  const dsNcc = useMemo(() => [...new Set((rows ?? []).map((r) => r.supplier_name).filter(Boolean))].sort() as string[], [rows])

  const loc = useMemo(() => {
    if (!rows) return []
    const tu = q.trim().toLowerCase()
    const out = rows.filter((r) => {
      if (nganh && r.nganh_hang !== nganh) return false
      if (brand && r.brand !== brand) return false
      if (ncc && r.supplier_name !== ncc) return false
      if (thieu && TRUONG_HOAN_THIEN.find((f) => f.id === thieu)?.co(r)) return false
      if (!tu) return true
      return (
        r.sku.toLowerCase().includes(tu) ||
        (r.ten_san_pham ?? '').toLowerCase().includes(tu) ||
        (r.subcategory_name ?? '').toLowerCase().includes(tu)
      )
    })
    const cot = COT.find((c) => c.key === sort.key)
    if (cot) {
      out.sort((a, b) => {
        const x = cot.sortVal(a)
        const y = cot.sortVal(b)
        const d = typeof x === 'string' ? x.localeCompare(y as string, 'vi') : (x as number) - (y as number)
        return d * sort.dir
      })
    }
    return out
  }, [rows, q, nganh, brand, ncc, thieu, sort])

  const thongKe = useMemo(() => {
    const r = rows ?? []
    return {
      sku: r.length,
      brand: new Set(r.map((x) => x.brand).filter(Boolean)).size,
      ncc: new Set(r.map((x) => x.supplier_code).filter(Boolean)).size,
      nganh: new Set(r.map((x) => x.nganh_hang).filter(Boolean)).size,
      thieuGiaVon: r.filter((x) => !TRUONG_HOAN_THIEN[0].co(x)).length,
      thieuLeadtime: r.filter((x) => !coGiaTri(x.leadtime)).length,
      dayDu: r.filter((x) => demHoanThien(x) === TRUONG_HOAN_THIEN.length).length,
    }
  }, [rows])

  const datLai = () => { setQ(''); setNganh(''); setBrand(''); setNcc(''); setThieu('') }
  const doiSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }))

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-head">
          <div className="mark">SLEEP EXPERT</div>
          <div className="name">Data App</div>
        </div>
        <nav>
          {MAN_HINH.map((g) => (
            <div key={g.nhom}>
              <div className="group">{g.nhom}</div>
              {g.muc.map((m) =>
                m.xong ? (
                  <a key={m.ten} className="on" href="#"><Icon ten={m.ic} />{m.ten}</a>
                ) : (
                  <a key={m.ten} className="soon" title="Màn này chưa dựng"><Icon ten={m.ic} />{m.ten}</a>
                ),
              )}
            </div>
          ))}
        </nav>
        <div className="rail-foot">Phòng Supply Chain<br />Bản dựng từng phần</div>
      </aside>

      <main>
        <div className="wrap">
          <div className="eyebrow">Dữ liệu nền</div>
          <h1>Master Data</h1>
          <p className="sub">
            Danh mục sản phẩm gốc. Mỗi dòng là một SKU bán được. Số liệu đã qua ba lớp kiểm tra
            của <code>contracts/sku-master.yaml</code> — dòng nào không đạt thì bị loại và ghi rõ
            lý do trong báo cáo nạp, không lặng lẽ vào kho.
          </p>

          {loi && (
            <div className="state"><b>Không đọc được dữ liệu</b>{loi}. Chạy lại lệnh nạp để sinh <code>public/data/master-sku.json</code>.</div>
          )}

          {rows && (
            <>
              <div className="stats">
                <div className="stat"><span className="v">{thongKe.sku}</span><span className="k">SKU trong danh mục</span></div>
                <div className="stat"><span className="v">{thongKe.brand}</span><span className="k">Brand</span></div>
                <div className="stat"><span className="v">{thongKe.ncc}</span><span className="k">Nhà cung cấp</span></div>
                <div className="stat"><span className="v">{thongKe.nganh}</span><span className="k">Ngành hàng</span></div>
                <div className="stat"><span className="v">{thongKe.dayDu}</span><span className="k">Khai báo đầy đủ</span></div>
                <div className="stat flag"><span className="v">{thongKe.thieuGiaVon}</span><span className="k">Chưa có giá vốn</span></div>
                <div className="stat flag"><span className="v">{thongKe.thieuLeadtime}</span><span className="k">Chưa có lead time</span></div>
              </div>

              <div className="filters">
                <div className="field">
                  <label htmlFor="q">Tìm theo mã, tên hoặc nhóm</label>
                  <input id="q" type="search" value={q} placeholder="ví dụ: MAT004 hoặc Power X Core" onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="f-nganh">Ngành hàng</label>
                  <select id="f-nganh" value={nganh} onChange={(e) => setNganh(e.target.value)}>
                    <option value="">Tất cả</option>
                    {dsNganh.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-brand">Brand</label>
                  <select id="f-brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
                    <option value="">Tất cả</option>
                    {dsBrand.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-ncc">Nhà cung cấp</label>
                  <select id="f-ncc" value={ncc} onChange={(e) => setNcc(e.target.value)}>
                    <option value="">Tất cả</option>
                    {dsNcc.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-thieu">Còn thiếu</label>
                  <select id="f-thieu" className={thieu ? 'flagged' : ''} value={thieu} onChange={(e) => setThieu(e.target.value)}>
                    <option value="">Không lọc</option>
                    {TRUONG_HOAN_THIEN.map((f) => (
                      <option key={f.id} value={f.id}>Chưa có {f.nhan.toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <button className="btn-reset" onClick={datLai}>Đặt lại</button>
                <div className="count">Hiện <b>{loc.length}</b>/{rows.length} SKU</div>
              </div>

              <div className="tablecard">
                <div className="tscroll">
                  <table>
                    <thead>
                      <tr>
                        {COT.map((c) => (
                          <th key={c.key} className={c.num ? 'num' : ''} onClick={() => doiSort(c.key)}
                              title={`Sắp xếp theo ${c.nhan}`}>
                            {c.nhan}
                            {sort.key === c.key && <span className="dir">{sort.dir === 1 ? '↑' : '↓'}</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loc.map((r) => (
                        <tr key={r.sku}>
                          {COT.map((c) => (
                            <td key={c.key} className={c.num ? 'num' : ''}>{c.render(r)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {loc.length === 0 && (
                    <div className="state"><b>Không có SKU nào khớp</b>Nới bộ lọc hoặc bấm Đặt lại.</div>
                  )}
                </div>
                <div className="ribbon-legend">
                  <span>Dải hoàn thiện, theo thứ tự:</span>
                  {TRUONG_HOAN_THIEN.map((f) => (
                    <span className="item" key={f.key}><i /> {f.nhan}</span>
                  ))}
                  <span className="item" style={{ marginLeft: 'auto' }}><i className="off" /> chưa có dữ liệu</span>
                </div>
              </div>
            </>
          )}

          {!rows && !loi && <div className="state">Đang đọc danh mục…</div>}
        </div>
      </main>
    </div>
  )
}
