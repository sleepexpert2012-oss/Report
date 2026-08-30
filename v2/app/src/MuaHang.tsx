import { Fragment, useEffect, useMemo, useState } from 'react'
import { docPo, type DongPo } from './kho'
import { tien } from './format'

/**
 * Màn Mua hàng — 21 đơn đặt hàng, 182 dòng, năm 2025.
 *
 * Bốn ô dữ liệu hỏng ở file nguồn được hiện thẳng lên màn thay vì lặng lẽ bỏ
 * qua. Người đọc số cần biết chỗ nào đang khuyết trước khi tin vào tổng.
 */

const trong = <span className="empty-val">—</span>

type Po = {
  po: string
  ncc: string
  so_dong: number
  sl: number
  tien_vat: number
  con_no: number
  ngay_nhan: string | null
  ngay_den_han: string | null
  trang_thai: string
  da_tra_ro: boolean
}

export default function MuaHang() {
  const [rows, setRows] = useState<DongPo[] | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [mo, setMo] = useState<string | null>(null)
  const [chiNo, setChiNo] = useState(false)

  useEffect(() => {
    docPo().then(setRows).catch((e) => setLoi(String(e.message ?? e)))
  }, [])

  const dsPo: Po[] = useMemo(() => {
    if (!rows) return []
    const m = new Map<string, DongPo[]>()
    rows.forEach((r) => m.set(r.po, [...(m.get(r.po) ?? []), r]))
    return [...m.entries()]
      .map(([po, d]) => {
        const ngay = d.map((x) => x.ngay_nhan).filter(Boolean).sort() as string[]
        const han = d.map((x) => x.ngay_den_han).filter(Boolean).sort() as string[]
        return {
          po,
          ncc: d[0].supplier_name,
          so_dong: d.length,
          sl: d.reduce((s, x) => s + (x.sl_xac_nhan ?? x.sl_dat ?? 0), 0),
          tien_vat: d.reduce((s, x) => s + (x.thanh_tien_vat ?? 0), 0),
          con_no: d.reduce((s, x) => s + (x.con_no ?? 0), 0),
          ngay_nhan: ngay.length ? ngay[ngay.length - 1] : null,
          ngay_den_han: han.length ? han[0] : null,
          trang_thai: d.some((x) => x.trang_thai_tt === 'Yes') ? 'Đã trả' : 'Chưa rõ',
          da_tra_ro: d.every((x) => x.trang_thai_tt),
        }
      })
      .sort((a, b) => (b.ngay_nhan ?? '').localeCompare(a.ngay_nhan ?? ''))
  }, [rows])

  const hien = chiNo ? dsPo.filter((p) => p.con_no > 0) : dsPo
  const tongTien = dsPo.reduce((s, p) => s + p.tien_vat, 0)
  const tongNo = dsPo.reduce((s, p) => s + p.con_no, 0)

  // Bốn ô hỏng ở file nguồn
  const thieuNgayDat = rows?.filter((r) => !r.ngay_dat).length ?? 0
  const thieuTrangThai = rows?.filter((r) => !r.trang_thai_tt).length ?? 0
  const thieuMaNcc = rows?.filter((r) => !r.supplier_code).length ?? 0
  const leadHong = rows?.filter((r) => (r.leadtime_nguon ?? 0) > 10000).length ?? 0
  const poAm = dsPo.filter((p) => p.con_no < -1)

  return (
    <>
      <div className="eyebrow">Dữ liệu nền</div>
      <h1>Mua hàng</h1>
      <p className="sub">
        Đơn đặt hàng gửi nhà cung cấp. Đây là <b>nguồn giá vốn gốc</b> — giá vốn trong danh mục SKU
        chính là lấy từ đây, nên 60 SKU chưa có giá vốn đúng là 60 SKU chưa từng được đặt mua.
      </p>

      {loi && <div className="state"><b>Không đọc được kho</b>{loi}</div>}

      {rows && (
        <>
          <div className="stats">
            <div className="stat"><span className="v">{dsPo.length}</span><span className="k">Đơn đặt hàng</span></div>
            <div className="stat"><span className="v">{rows.length}</span><span className="k">Dòng hàng</span></div>
            <div className="stat"><span className="v">{tien(tongTien)}</span><span className="k">Tổng mua có VAT (đ)</span></div>
            <div className="stat"><span className="v">{tien(tongNo) ?? '0'}</span><span className="k">Còn nợ theo file (đ)</span></div>
            <div className="stat flag"><span className="v">{thieuTrangThai}</span><span className="k">Dòng chưa rõ đã trả hay chưa</span></div>
          </div>

          <div className="filters">
            <label className={'toggle' + (chiNo ? ' on' : '')}>
              <input type="checkbox" checked={chiNo} onChange={(e) => setChiNo(e.target.checked)} />
              Chỉ hiện đơn còn nợ
            </label>
            <div className="count">Hiện <b>{hien.length}</b>/{dsPo.length} đơn</div>
          </div>

          <div className="tablecard" style={{ marginBottom: 'var(--sp-5)' }}>
            <div className="card-hd">
              <h2>Đơn đặt hàng</h2>
              <p className="card-sub">Bấm một đơn để xem từng dòng hàng bên trong</p>
            </div>
            <div className="tscroll" style={{ maxHeight: 'none' }}>
              <table>
                <thead>
                  <tr>
                    {['PO', 'Nhà cung cấp', 'Dòng', 'Số lượng', 'Tiền có VAT', 'Còn nợ', 'Ngày nhận', 'Đến hạn', 'Thanh toán']
                      .map((h, i) => <th key={h} className={i >= 2 && i <= 5 ? 'num' : ''} style={{ cursor: 'default' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {hien.map((p) => (
                    <Fragment key={p.po}>
                      <tr onClick={() => setMo(mo === p.po ? null : p.po)}
                          style={{ cursor: 'pointer', background: mo === p.po ? 'var(--accent-soft)' : undefined }}>
                        <td><span className="mono">{mo === p.po ? '▾' : '▸'} {p.po}</span></td>
                        <td>{p.ncc}</td>
                        <td className="num mono">{p.so_dong}</td>
                        <td className="num mono">{p.sl.toLocaleString('vi-VN')}</td>
                        <td className="num mono">{tien(p.tien_vat) ?? trong}</td>
                        <td className="num mono">{tien(p.con_no) ?? trong}</td>
                        <td className="num mono">{p.ngay_nhan ?? trong}</td>
                        <td className="num mono">{p.ngay_den_han ?? trong}</td>
                        <td>
                          <span className={'keo keo-' + (p.trang_thai === 'Đã trả' ? 'ok' : 'han')}>
                            {p.trang_thai}
                          </span>
                        </td>
                      </tr>
                      {mo === p.po && rows.filter((r) => r.po === p.po).map((r) => (
                        <tr key={p.po + '-' + r.stt} className="dong-con">
                          <td></td>
                          <td colSpan={2}>
                            <span className="mono">{r.sku}</span>{' '}
                            <span className="dim">{(r.mo_ta ?? '').slice(0, 46)}</span>
                          </td>
                          <td className="num mono">{r.sl_xac_nhan ?? r.sl_dat ?? trong}</td>
                          <td className="num mono">{tien(r.thanh_tien_vat) ?? trong}</td>
                          <td className="num mono">{tien(r.con_no) ?? trong}</td>
                          <td className="num mono">{r.ngay_nhan ?? trong}</td>
                          <td className="num mono">{r.ngay_den_han ?? trong}</td>
                          <td className="dim">{r.trang_thai_tt ?? trong}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="tablecard canh-bao">
            <div className="card-hd">
              <h2>Những chỗ hỏng ở file nguồn</h2>
              <p className="card-sub">
                Tầng nạp ghi nguyên văn và báo lên đây, không tự sửa dữ liệu của anh
              </p>
            </div>
            <div className="khoi">
              <div className="doi">
                <span className="doi-k mono">Paid Amount</span>
                <span className="doi-v">
                  <b>76/{rows.length}</b> ô ghi chữ <span className="mono">False</span> thay vì số tiền.
                  Lớp kiểm tra bắt được là sai kiểu nên để trống ô đó — nếu không, chữ False sẽ lọt vào cột tiền.
                </span>
              </div>
              <div className="doi">
                <span className="doi-k mono">Date Request</span>
                <span className="doi-v">
                  <b>{thieuNgayDat}/{rows.length}</b> dòng bỏ trống ngày đặt.
                  Đây chính là lý do cột <span className="mono">Leadtime</span> trong file trả ra
                  {' '}<b>{leadHong}</b> giá trị kiểu <span className="mono">45879</span> — đó là số thứ tự ngày của
                  Excel, không phải số ngày. Công thức lấy <i>ngày nhận trừ ngày đặt</i> mà ngày đặt trống.
                  <b> Vì vậy màn này không tính lead time thực tế.</b>
                </span>
              </div>
              <div className="doi">
                <span className="doi-k mono">Payment status</span>
                <span className="doi-v">
                  <b>{thieuTrangThai}/{rows.length}</b> dòng để trống, nên không phân biệt được
                  “chưa trả” với “chưa điền”. Con số công nợ ở trên vì thế là <b>số theo file</b>,
                  chưa phải số đã đối chiếu.
                </span>
              </div>
              {poAm.length > 0 && (
                <div className="doi">
                  <span className="doi-k mono">Outstanding Amount</span>
                  <span className="doi-v">
                    <b>{poAm.length}</b> đơn có công nợ <b>âm</b>, cộng lại{' '}
                    <b>{tien(Math.abs(poAm.reduce((s, p) => s + p.con_no, 0)))}đ</b>
                    {' '}({poAm.map((p) => p.po).join(', ')}). Trả thừa, hay ghi nhầm? Con số tổng
                    công nợ ở trên đang bị hai đơn này kéo xuống.
                  </span>
                </div>
              )}
              <div className="doi">
                <span className="doi-k mono">Supplier code</span>
                <span className="doi-v">
                  <b>{thieuMaNcc}/{rows.length}</b> dòng bỏ trống mã nhà cung cấp. Màn Nhà cung cấp
                  đang phải ghép theo tên để không mất dòng nào.
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {!rows && !loi && <div className="state">Đang đọc kho…</div>}
    </>
  )
}
