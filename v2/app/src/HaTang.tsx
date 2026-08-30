import { useEffect, useState } from 'react'
import { demDong, docCacLo, docSnapshot, type LoNap } from './kho'

/**
 * Màn Cơ sở hạ tầng — trả lời ba câu:
 *   app này được dựng ra sao · dữ liệu lấy từ đâu · cập nhật lúc nào.
 *
 * Số dòng và thời điểm cập nhật đọc SỐNG từ kho, không gõ tay. Tài liệu gõ tay
 * thì lạc hậu sau vài tuần; màn này luôn đúng vì nó tự hỏi lại hệ thống.
 */

type Nguon = {
  bang: string
  mo_ta: string
  nguon: 'API' | 'Excel' | 'Tính ra'
  ai_ghi: string
  nhip: string
  keo_lai: 'Được' | 'Có giới hạn' | 'Không'
  ghi_chu?: string
}

const NGUON: Nguon[] = [
  { bang: 'sales_fact', mo_ta: 'Đơn hàng Shopee, mỗi dòng một loại hàng trong một đơn',
    nguon: 'API', ai_ghi: 'ops-sync', nhip: 'Mỗi lần pipeline chạy', keo_lai: 'Có giới hạn',
    ghi_chu: 'Shopee giữ lịch sử có hạn — chưa kiểm chứng lùi được tới đâu. Đừng xoá trước khi thử.' },
  { bang: 'ads_fact', mo_ta: 'Chi phí và hiệu quả quảng cáo Shopee',
    nguon: 'API', ai_ghi: 'bright-responder', nhip: 'Mỗi lần pipeline chạy', keo_lai: 'Không',
    ghi_chu: 'Shopee KHÔNG còn lưu chi phí Ads của 2025 và 03/2026. Mất là mất hẳn.' },
  { bang: 'ads_keyword', mo_ta: 'Từ khoá và giá thầu',
    nguon: 'API', ai_ghi: 'smart-endpoint', nhip: 'Mỗi lần pipeline chạy', keo_lai: 'Được' },
  { bang: 'tonkho', mo_ta: 'Tồn kho theo từng kho, ảnh chụp tại thời điểm đồng bộ',
    nguon: 'API', ai_ghi: 'inventory-responder', nhip: 'Mỗi lần pipeline chạy', keo_lai: 'Được',
    ghi_chu: 'Chỉ là ảnh chụp hiện tại, không có lịch sử tồn theo ngày.' },
  { bang: 'v2_dim_sku', mo_ta: 'Danh mục SKU của app mới, theo lô',
    nguon: 'Excel', ai_ghi: 'ingest.load', nhip: 'Khi người phụ trách nạp', keo_lai: 'Được',
    ghi_chu: 'File gốc lưu ở data-goc/upload-erp/, nạp lại lúc nào cũng được.' },
  { bang: 'v2_dim_supplier', mo_ta: 'Nhà cung cấp, lead time, MOQ',
    nguon: 'Excel', ai_ghi: 'ingest.load', nhip: 'Khi người phụ trách nạp', keo_lai: 'Được' },
  { bang: 'v2_dim_brand', mo_ta: 'Thương hiệu tiêu dùng — tách hẳn khỏi nhà cung cấp',
    nguon: 'Excel', ai_ghi: 'ingest.load', nhip: 'Khi người phụ trách nạp', keo_lai: 'Được' },
  { bang: 'snapshot', mo_ta: 'Dữ liệu tính sẵn cho app đời trước',
    nguon: 'Tính ra', ai_ghi: 'build_snapshot.py', nhip: 'Cuối mỗi lần pipeline chạy', keo_lai: 'Được',
    ghi_chu: 'Tính lại từ các bảng nguồn, không phải dữ liệu gốc.' },
]

const BUOC = [
  { n: '1', ten: 'Shopee trả dữ liệu', mo: 'Bảy Edge Function gọi API Shopee theo thứ tự cố định: đơn hàng, quảng cáo, tồn kho, đối soát, affiliate, video.' },
  { n: '2', ten: 'Cổng tươi chặn', mo: 'Mọi checkpoint phải mới hơn thời điểm bắt đầu lần chạy. Một nguồn cũ là dừng — thà giữ số cũ còn hơn công bố số nửa cũ nửa mới.' },
  { n: '3', ten: 'Chuẩn hoá', mo: 'revenue_rules.py là nơi DUY NHẤT định nghĩa doanh thu và giá vốn. Mọi màn đều lấy từ đây nên không màn nào hiểu "doanh thu" theo kiểu riêng.' },
  { n: '4', ten: 'Ghi vào kho', mo: 'Dữ liệu API ghi thẳng vào bảng. Danh mục từ Excel đi qua ba lớp kiểm tra rồi mới vào, theo từng lô có đường lùi.' },
  { n: '5', ten: 'App đọc', mo: 'Đọc qua khung nhìn v2_*_hien_hanh nên đổi lô là app đổi theo, không phải sửa code.' },
]

const bang = (n: number | null) => (n === null ? '—' : n.toLocaleString('vi-VN'))

export default function HaTang() {
  const [dem, setDem] = useState<Record<string, number | null>>({})
  const [lo, setLo] = useState<(LoNap & { dang_dung: boolean })[]>([])
  const [snap, setSnap] = useState<{ created_at: string; bytes: number } | null>(null)
  const [loi, setLoi] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      Promise.all(NGUON.map((n) => demDong(n.bang).then((v) => [n.bang, v] as const))),
      docCacLo(),
      docSnapshot(),
    ])
      .then(([d, l, s]) => { setDem(Object.fromEntries(d)); setLo(l); setSnap(s) })
      .catch((e) => setLoi(String(e.message ?? e)))
  }, [])

  const tuoi = snap ? Math.round((Date.now() - new Date(snap.created_at).getTime()) / 60000) : null
  const tuoiChu = tuoi === null ? '—' : tuoi < 90 ? `${tuoi} phút trước` : `${Math.round(tuoi / 60)} giờ trước`

  return (
    <>
      <div className="eyebrow">Vận hành</div>
      <h1>Cơ sở hạ tầng</h1>
      <p className="sub">
        App này được dựng ra sao, dữ liệu lấy từ đâu, và cập nhật lúc nào. Số dòng cùng thời
        điểm cập nhật trên trang đọc <b>trực tiếp từ hệ thống</b> mỗi lần mở — không phải chữ gõ tay
        rồi để lạc hậu.
      </p>

      {loi && <div className="state"><b>Không đọc được trạng thái hệ thống</b>{loi}</div>}

      <div className="stats">
        <div className="stat"><span className="v">{tuoiChu}</span><span className="k">Dữ liệu Shopee cập nhật lần cuối</span></div>
        <div className="stat"><span className="v">{bang(dem.sales_fact ?? null)}</span><span className="k">Dòng đơn hàng</span></div>
        <div className="stat"><span className="v">{bang(dem.v2_dim_sku ?? null)}</span><span className="k">SKU trong danh mục</span></div>
        <div className="stat"><span className="v">{lo.length}</span><span className="k">Lô master đã nạp</span></div>
      </div>

      <div className="tablecard" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="card-hd">
          <h2>Dữ liệu đi từ đâu tới màn hình</h2>
          <p className="card-sub">Năm bước, mỗi bước có một chốt chặn riêng</p>
        </div>
        <div className="luong">
          {BUOC.map((b) => (
            <div className="buoc" key={b.n}>
              <span className="buoc-n">{b.n}</span>
              <div>
                <div className="buoc-ten">{b.ten}</div>
                <p className="buoc-mo">{b.mo}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tablecard" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="card-hd">
          <h2>Sổ đăng ký nguồn dữ liệu</h2>
          <p className="card-sub">
            Cột <b>Kéo lại được</b> là cột quan trọng nhất — nó quyết định có được phép xoá bảng đó hay không
          </p>
        </div>
        <div className="tscroll" style={{ maxHeight: 'none' }}>
          <table>
            <thead>
              <tr>
                <th style={{ cursor: 'default' }}>Bảng</th>
                <th style={{ cursor: 'default' }}>Chứa gì</th>
                <th style={{ cursor: 'default' }}>Nguồn</th>
                <th style={{ cursor: 'default' }}>Nơi ghi</th>
                <th style={{ cursor: 'default' }}>Nhịp</th>
                <th className="num" style={{ cursor: 'default' }}>Số dòng</th>
                <th style={{ cursor: 'default' }}>Kéo lại được</th>
              </tr>
            </thead>
            <tbody>
              {NGUON.map((n) => (
                <tr key={n.bang}>
                  <td><span className="mono">{n.bang}</span></td>
                  <td>
                    <div className="ht-mo">{n.mo_ta}</div>
                    {n.ghi_chu && <div className="ht-note">{n.ghi_chu}</div>}
                  </td>
                  <td><span className={'pill' + (n.nguon === 'API' ? ' brand-px' : '')}>{n.nguon}</span></td>
                  <td><span className="mono dim">{n.ai_ghi}</span></td>
                  <td className="dim">{n.nhip}</td>
                  <td className="num mono">{bang(dem[n.bang] ?? null)}</td>
                  <td>
                    <span className={'keo keo-' + (n.keo_lai === 'Được' ? 'ok' : n.keo_lai === 'Không' ? 'no' : 'han')}>
                      {n.keo_lai}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hai-cot">
        <div className="tablecard">
          <div className="card-hd">
            <h2>Lịch cập nhật</h2>
            <p className="card-sub">Lịch khai báo và nhịp chạy thật không giống nhau</p>
          </div>
          <div className="khoi">
            <div className="doi">
              <span className="doi-k">Lịch khai trong pipeline</span>
              <span className="doi-v mono">35 phút mỗi giờ · 24 lần/ngày</span>
            </div>
            <div className="doi">
              <span className="doi-k">Nhịp chạy thật 6 ngày qua</span>
              <span className="doi-v mono" style={{ color: 'var(--warn)' }}>12 · 15 · 3 · 2 · 5 · 3 lần/ngày</span>
            </div>
            <p className="khoi-note">
              GitHub Actions không bảo đảm chạy đúng giờ cho lịch cron, và giãn ra khi hệ thống
              bận. Từ 27/08 nhịp tụt còn 2–5 lần mỗi ngày, nghĩa là số liệu có lúc cũ tới
              5–7 tiếng. <b>Đây là hạn chế của nền tảng, không phải lỗi cấu hình.</b> Nếu cần tươi hơn
              thì phải đổi sang nơi chạy lịch khác.
            </p>
            <div className="doi">
              <span className="doi-k">Danh mục SKU</span>
              <span className="doi-v">Không tự động — nạp khi người phụ trách chạy</span>
            </div>
          </div>
        </div>

        <div className="tablecard">
          <div className="card-hd">
            <h2>Lô master đã nạp</h2>
            <p className="card-sub">Lô cũ giữ nguyên, đổi lô là app đổi theo</p>
          </div>
          <div className="khoi">
            {lo.length === 0 && <p className="khoi-note">Chưa có lô nào.</p>}
            {lo.map((l) => (
              <div className={'lo' + (l.dang_dung ? ' lo-on' : '')} key={l.id}>
                <div className="lo-top">
                  <span className="mono lo-id">#{l.id}</span>
                  {l.dang_dung && <span className="pill brand-px">Đang dùng</span>}
                  <span className="lo-time dim">{new Date(l.tao_luc).toLocaleString('vi-VN')}</span>
                </div>
                <div className="lo-nguon mono">{l.nguon}</div>
                <div className="dim" style={{ fontSize: 12 }}>
                  nhận <b>{l.so_dong_nhan}</b> · loại <b>{l.so_dong_loai}</b> dòng · {l.nguoi_nap}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="tablecard" style={{ marginTop: 'var(--sp-5)' }}>
        <div className="card-hd">
          <h2>App chạy trên cái gì</h2>
        </div>
        <div className="khoi">
          {[
            ['Giao diện', 'Vite + React + TypeScript, dựng ra file tĩnh'],
            ['Kho dữ liệu', 'Supabase Postgres · đọc qua PostgREST · quyền đọc/ghi tách bằng RLS'],
            ['Đồng bộ Shopee', 'Bảy Edge Function viết bằng Deno, chạy trên Supabase'],
            ['Chạy theo lịch', 'GitHub Actions'],
            ['Chuẩn hoá nghiệp vụ', 'Python — revenue_rules.py, có test'],
            ['Nạp danh mục', 'Python — hợp đồng YAML + ba lớp kiểm tra'],
          ].map(([k, v]) => (
            <div className="doi" key={k}>
              <span className="doi-k">{k}</span>
              <span className="doi-v">{v}</span>
            </div>
          ))}
          <p className="khoi-note">
            Khoá anon nhúng trong trình duyệt là <b>đúng thiết kế</b>: RLS trên các bảng <span className="mono">v2_</span> chỉ
            cho đọc. Đã kiểm chứng — thử ghi bằng khoá này trả về lỗi 401.
          </p>
        </div>
      </div>
    </>
  )
}
