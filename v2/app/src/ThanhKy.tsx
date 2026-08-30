import { CHI_SO, PRESET, SS, khoangSS, macDinh, nhanKhoang, nhanThang, presetDangChon, type TrangThaiKy } from './ky'

/**
 * Thanh kỳ phân tích — dùng chung cho mọi màn có trục thời gian.
 *
 * `chuoi` là giá trị từng tháng của TOÀN BỘ lịch sử, khớp chỉ số với `thang`.
 * Dải nhỏ bên dưới vẽ nguyên chuỗi đó: tháng trong kỳ chọn tô chàm, tháng
 * trong kỳ so sánh tô vàng đồng, còn lại để xám. Nhờ vậy người đọc thấy ngay
 * mình đang cắt ở đoạn nào của lịch sử — thứ mà nhìn hai ô chọn tháng không
 * thấy được.
 */
export default function ThanhKy({
  thang, k, doi, chuoi,
}: {
  thang: string[]
  k: TrangThaiKy
  doi: (moi: TrangThaiKy) => void
  chuoi?: number[]
}) {
  const pres = presetDangChon(thang, k)
  const rSS = khoangSS(thang, k)
  const daiNay = k.m1 - k.m0 + 1
  const daiSS = rSS ? rSS[1] - rSS[0] + 1 : 0
  const lech = !!rSS && daiSS !== daiNay

  const chon = (ten: keyof TrangThaiKy, v: number | string) => doi({ ...k, [ten]: v } as TrangThaiKy)
  const opt = (i: number) => <option key={thang[i]} value={i}>{nhanThang(thang[i])}</option>

  return (
    <div className="gbar">
      <div className="gbar-hang">
        <div className="field">
          <label>Kỳ phân tích</label>
          <div className="presets">
            {PRESET.map((p) => {
              const r = p.tinh(thang)
              return (
                <button key={p.id} disabled={!r} className={pres === p.id ? 'on' : ''}
                        onClick={() => r && doi({ ...k, m0: r[0], m1: r[1] })}>
                  {p.nhan}
                </button>
              )
            })}
          </div>
        </div>

        <div className="field">
          <label htmlFor="k-m0">Từ tháng</label>
          <select id="k-m0" value={k.m0} onChange={(e) => {
            const v = +e.target.value
            doi({ ...k, m0: v, m1: Math.max(v, k.m1) })
          }}>{thang.map((_, i) => opt(i))}</select>
        </div>

        <div className="field">
          <label htmlFor="k-m1">Đến tháng</label>
          <select id="k-m1" value={k.m1} onChange={(e) => {
            const v = +e.target.value
            doi({ ...k, m1: v, m0: Math.min(v, k.m0) })
          }}>{thang.map((_, i) => opt(i))}</select>
        </div>

        <div className="field">
          <label htmlFor="k-ss">So sánh với</label>
          <select id="k-ss" value={k.ss} onChange={(e) => chon('ss', e.target.value)}>
            {SS.map((s) => <option key={s.id} value={s.id}>{s.nhan}</option>)}
          </select>
        </div>

        {k.ss === 'custom' && (
          <>
            <div className="field">
              <label htmlFor="k-c0">SS từ</label>
              <select id="k-c0" value={k.c0} onChange={(e) => chon('c0', +e.target.value)}>
                {thang.map((_, i) => opt(i))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="k-c1">SS đến</label>
              <select id="k-c1" value={k.c1} onChange={(e) => chon('c1', +e.target.value)}>
                {thang.map((_, i) => opt(i))}
              </select>
            </div>
          </>
        )}

        <div className="field">
          <label>Chỉ số biểu đồ</label>
          <div className="mtoggle">
            {CHI_SO.map((c) => (
              <button key={c.id} className={k.chiSo === c.id ? 'on' : ''} onClick={() => chon('chiSo', c.id)}>
                {c.nhan}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-reset dat-lai" onClick={() => doi(macDinh(thang))}>Đặt lại</button>
      </div>

      {chuoi && chuoi.length === thang.length && thang.length > 1 && (
        <Dai thang={thang} chuoi={chuoi} nay={[k.m0, k.m1]} ss={rSS} />
      )}

      <div className="gbar-txt">
        <span>Kỳ chọn <b>{nhanKhoang(thang, [k.m0, k.m1])}</b> · {daiNay} tháng</span>
        <span className="cach">·</span>
        <span>
          So sánh <b>{k.ss === 'none' ? 'không so sánh' : nhanKhoang(thang, rSS)}</b>
          {rSS && ` · ${daiSS} tháng`}
        </span>
        {lech && (
          <span className="lech">
            ⚠ hai kỳ khác độ dài — mức tăng giảm đã quy về bình quân {daiNay} tháng để so cho công bằng
          </span>
        )}
        {k.ss !== 'none' && !rSS && <span className="lech">⚠ không đủ dữ liệu cho kỳ so sánh</span>}
      </div>
    </div>
  )
}

/** Dải lịch sử: mỗi tháng một cột, tô theo vai trò của tháng đó trong kỳ. */
function Dai({
  thang, chuoi, nay, ss,
}: {
  thang: string[]; chuoi: number[]; nay: [number, number]; ss: [number, number] | null
}) {
  const max = Math.max(...chuoi, 1)
  const trong = (i: number, r: [number, number] | null) => !!r && i >= r[0] && i <= r[1]
  return (
    <div className="dai-ky" role="img"
         aria-label={`Dải lịch sử ${thang.length} tháng, kỳ chọn ${nhanKhoang(thang, nay)}`}>
      {thang.map((t, i) => {
        const vai = trong(i, nay) ? 'nay' : trong(i, ss) ? 'ss' : 'ngoai'
        return (
          <span key={t} className={'dai-cot ' + vai}
                title={`${nhanThang(t)} · ${(chuoi[i] / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`}>
            <i style={{ height: `${Math.max(6, (chuoi[i] / max) * 100)}%` }} />
          </span>
        )
      })}
    </div>
  )
}
