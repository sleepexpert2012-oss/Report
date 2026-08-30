import { useState } from 'react'
import { Icon } from './icons'
import MasterData from './MasterData'
import HaTang from './HaTang'

/** Khung ngoài: thanh điều hướng + màn đang mở. */

type Muc = { id: string; ic: string; ten: string; man?: () => React.ReactElement }

const MAN_HINH: { nhom: string; muc: Muc[] }[] = [
  { nhom: 'Dữ liệu', muc: [
    { id: 'master', ic: 'master', ten: 'Master Data', man: MasterData },
    { id: 'ncc', ic: 'ncc', ten: 'Nhà cung cấp' },
    { id: 'mua', ic: 'mua', ten: 'Mua hàng' },
  ]},
  { nhom: 'Bán hàng', muc: [
    { id: 'tongquan', ic: 'tongquan', ten: 'Tổng quan' },
    { id: 'nganh', ic: 'nganh', ten: 'Ngành & Brand' },
    { id: 'pl', ic: 'pl', ten: 'Tài chính P&L' },
  ]},
  { nhom: 'Vận hành', muc: [
    { id: 'ton', ic: 'ton', ten: 'Tồn kho' },
    { id: 'hatang', ic: 'hatang', ten: 'Cơ sở hạ tầng', man: HaTang },
  ]},
]

export default function App() {
  const [man, setMan] = useState('master')
  const dangMo = MAN_HINH.flatMap((g) => g.muc).find((m) => m.id === man)
  const Man = dangMo?.man ?? MasterData

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
                m.man ? (
                  <a key={m.id} className={m.id === man ? 'on' : ''} tabIndex={0}
                     onClick={() => setMan(m.id)}
                     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMan(m.id) } }}>
                    <Icon ten={m.ic} />{m.ten}
                  </a>
                ) : (
                  <a key={m.id} className="soon" title="Màn này chưa dựng"><Icon ten={m.ic} />{m.ten}</a>
                ),
              )}
            </div>
          ))}
        </nav>
        <div className="rail-foot">Phòng Supply Chain<br />Bản dựng từng phần</div>
      </aside>

      <main>
        <div className="wrap">
          <Man />
        </div>
      </main>
    </div>
  )
}
