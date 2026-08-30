import { useEffect, useMemo, useState } from 'react'
import { docNcc, docPo, type DongPo, type Ncc } from './kho'
import { tien } from './format'

/**
 * Màn Nhà cung cấp.
 *
 * App đời trước có màn này nhưng chạy trên dữ liệu rỗng hoàn toàn — không một
 * dòng đơn đặt hàng nào. Giờ nó đứng trên 182 dòng mua hàng thật, nên mỗi nhà
 * cung cấp có số tiền, số đơn và công nợ thật đi kèm.
 */

const MAU = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--muted)']
const trong = <span className="empty-val">—</span>

type Gop = Ncc & { so_po: number; so_dong: number; tong_mua: number; con_no: number; lan_nhan_cuoi: string | null }

export default function NhaCungCap() {
  const [ncc, setNcc] = useState<Ncc[] | null>(null)
  const [po, setPo] = useState<DongPo[] | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [chon, setChon] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([docNcc(), docPo()])
      .then(([n, p]) => { setNcc(n); setPo(p) })
      .catch((e) => setLoi(String(e.message ?? e)))
  }, [])

  const gop: Gop[] = useMemo(() => {
    if (!ncc || !po) return []
    return ncc
      .map((n) => {
        // Ghép theo TÊN vì 26/182 dòng mua hàng bỏ trống mã nhà cung cấp.
        const d = po.filter((x) => x.supplier_name === n.supplier_name)
        const ngay = d.map((x) => x.ngay_nhan).filter(Boolean).sort() as string[]
        return {
          ...n,
          so_po: new Set(d.map((x) => x.po)).size,
          so_dong: d.length,
          tong_mua: d.reduce((s, x) => s + (x.thanh_tien_vat ?? 0), 0),
          con_no: d.reduce((s, x) => s + (x.con_no ?? 0), 0),
          lan_nhan_cuoi: ngay.length ? ngay[ngay.length - 1] : null,
        }
      })
      .sort((a, b) => b.tong_mua - a.tong_mua)
  }, [ncc, po])

  const tong = gop.reduce((s, g) => s + g.tong_mua, 0)
  const thieuLead = gop.filter((g) => !g.lead_time_nguon).length
  const khongPo = gop.filter((g) => g.so_po === 0).length
  const dongThieuMa = po?.filter((x) => !x.supplier_code).length ?? 0

  return (
    <>
      <div className="eyebrow">Dữ liệu nền</div>
      <h1>Nhà cung cấp</h1>
      <p className="sub">
        Sáu nhà cung cấp, ghép với đơn đặt hàng thật để biết mỗi bên đang chiếm bao nhiêu tiền mua,
        còn nợ bao nhiêu và giao hàng lần cuối khi nào.
      </p>

      {loi && <div className="state"><b>Không đọc được kho</b>{loi}</div>}

      {ncc && po && (
        <>
          <div className="stats">
            <div className="stat"><span className="v">{gop.length}</span><span className="k">Nhà cung cấp</span></div>
            <div className="stat"><span className="v">{tien(tong)}</span><span className="k">Tổng mua có VAT (đ)</span></div>
            <div className="stat"><span className="v">{new Set(po.map((x) => x.po)).size}</span><span className="k">Đơn đặt hàng</span></div>
            <div className="stat flag"><span className="v">{thieuLead}</span><span className="k">Chưa khai lead time</span></div>
            {khongPo > 0 && <div className="stat flag"><span className="v">{khongPo}</span><span className="k">Chưa có đơn nào</span></div>}
          </div>

          <div className="tablecard" style={{ marginBottom: 'var(--sp-5)' }}>
            <div className="card-hd">
              <h2>Tỷ trọng tiền mua</h2>
              <p className="card-sub">Triệu đồng, đã gồm VAT · bấm một nhà cung cấp để xem đơn hàng của họ</p>
            </div>
            <div style={{ padding: 'var(--sp-4)' }}>
              <svg viewBox={`0 0 640 ${gop.length * 30 + 6}`} width="100%" height={gop.length * 30 + 6}
                   role="img" aria-label="Tỷ trọng tiền mua theo nhà cung cấp">
                {gop.map((g, i) => {
                  const max = gop[0]?.tong_mua || 1
                  const y = i * 30 + 5
                  const len = Math.max(2, (g.tong_mua / max) * 330)
                  return (
                    <g key={g.supplier_code} style={{ cursor: 'pointer' }}
                       onClick={() => setChon(chon === g.supplier_name ? null : g.supplier_name)}>
                      <text x="0" y={y + 12} fontSize="12.5" fill="var(--ink)"
                            fontWeight={chon === g.supplier_name ? 600 : 400}>{g.supplier_name}</text>
                      <rect x="190" y={y} width={len} height="16" rx="4" fill={MAU[i % MAU.length]}
                            opacity={chon && chon !== g.supplier_name ? 0.35 : 1}>
                        <title>{g.supplier_name} · {tien(g.tong_mua)}đ · {(g.tong_mua / tong * 100).toFixed(1)}%</title>
                      </rect>
                      <text x={190 + len + 9} y={y + 12} fontSize="11.5" fill="var(--ink)" className="mono">
                        {Math.round(g.tong_mua / 1e6).toLocaleString('vi-VN')}
                      </text>
                      <text x="640" y={y + 12} textAnchor="end" fontSize="11" fill="var(--muted)" className="mono">
                        {(g.tong_mua / tong * 100).toFixed(0)}%
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          <div className="tablecard" style={{ marginBottom: 'var(--sp-5)' }}>
            <div className="card-hd">
              <h2>Danh sách nhà cung cấp</h2>
              <p className="card-sub">Lead time và MOQ lấy từ sheet khai báo; số đơn và tiền lấy từ đơn đặt hàng thật</p>
            </div>
            <div className="tscroll" style={{ maxHeight: 'none' }}>
              <table>
                <thead>
                  <tr>
                    {['Nhà cung cấp', 'Mã', 'SKU', 'Giao hàng', 'Lead time', 'MOQ', 'Công nợ', 'Đơn', 'Dòng', 'Tiền mua', 'Còn nợ', 'Nhận cuối']
                      .map((h, i) => <th key={h} className={i >= 2 && i <= 5 || i >= 7 ? 'num' : ''} style={{ cursor: 'default' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {gop.map((g) => (
                    <tr key={g.supplier_code} onClick={() => setChon(chon === g.supplier_name ? null : g.supplier_name)}
                        style={{ cursor: 'pointer', background: chon === g.supplier_name ? 'var(--accent-soft)' : undefined }}>
                      <td>{g.supplier_name}</td>
                      <td><span className="mono dim">{g.supplier_code}</span></td>
                      <td className="num mono">{g.so_sku}</td>
                      <td>{g.giao_hang ?? trong}</td>
                      <td className="num mono">{g.lead_time_nguon ?? trong}</td>
                      <td className="num mono">{g.moq ?? trong}</td>
                      <td className="num mono">{g.payment_terms ? `${g.payment_terms} ngày` : trong}</td>
                      <td className="num mono">{g.so_po || trong}</td>
                      <td className="num mono">{g.so_dong || trong}</td>
                      <td className="num mono">{tien(g.tong_mua) ?? trong}</td>
                      <td className="num mono">{tien(g.con_no) ?? trong}</td>
                      <td className="num mono">{g.lan_nhan_cuoi ?? trong}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {chon && (
            <div className="tablecard" style={{ marginBottom: 'var(--sp-5)' }}>
              <div className="card-hd">
                <h2>Đơn hàng của {chon}</h2>
                <p className="card-sub">Bấm lại vào tên nhà cung cấp để đóng</p>
              </div>
              <div className="tscroll">
                <table>
                  <thead>
                    <tr>{['PO', 'Mã hàng', 'Mô tả', 'SL', 'Giá mua', 'Thành tiền có VAT', 'Ngày nhận', 'Trạng thái']
                      .map((h, i) => <th key={h} className={i === 3 || i === 4 || i === 5 ? 'num' : ''} style={{ cursor: 'default' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {po.filter((x) => x.supplier_name === chon).map((x) => (
                      <tr key={x.stt}>
                        <td><span className="mono">{x.po}</span></td>
                        <td><span className="mono">{x.sku}</span></td>
                        <td><div className="name" title={x.mo_ta ?? ''}>{x.mo_ta ?? trong}</div></td>
                        <td className="num mono">{x.sl_xac_nhan ?? x.sl_dat ?? trong}</td>
                        <td className="num mono">{tien(x.gia_mua) ?? trong}</td>
                        <td className="num mono">{tien(x.thanh_tien_vat) ?? trong}</td>
                        <td className="num mono">{x.ngay_nhan ?? trong}</td>
                        <td>{x.trang_thai_nhan ?? trong}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(thieuLead > 0 || dongThieuMa > 0) && (
            <div className="tablecard canh-bao">
              <div className="card-hd">
                <h2>Dữ liệu còn thiếu ở nguồn</h2>
                <p className="card-sub">Hiện ra để sửa ở file gốc, không tự đoán hộ</p>
              </div>
              <div className="khoi">
                {thieuLead > 0 && (
                  <div className="doi">
                    <span className="doi-k">Lead time</span>
                    <span className="doi-v">
                      <b>{thieuLead}/{gop.length}</b> nhà cung cấp chưa khai. Thiếu nó thì kế hoạch đặt hàng
                      phải đoán — app đời trước đoán bằng bảng brand của một công ty khác.
                    </span>
                  </div>
                )}
                {dongThieuMa > 0 && (
                  <div className="doi">
                    <span className="doi-k">Mã nhà cung cấp</span>
                    <span className="doi-v">
                      <b>{dongThieuMa}/{po.length}</b> dòng mua hàng bỏ trống mã. Màn này đang ghép theo <b>tên</b>
                      {' '}để không mất dòng nào, nhưng tên không phải khoá — trùng tên hoặc gõ khác một ký tự là lệch.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!ncc && !loi && <div className="state">Đang đọc kho…</div>}
    </>
  )
}
