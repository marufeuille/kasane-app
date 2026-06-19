import { useEffect, useState } from 'react'
import type { AspectRatio } from './types'
import { useKasane } from './state/store'
import CanvasStage from './canvas/CanvasStage'
import StylePanel from './panels/Style'
import AddPartPanel from './panels/AddPart'
import LayersPanel from './panels/Layers'
import InspectorPanel from './panels/Inspector'
import SettingsPanel from './panels/Settings'

const ASPECTS: AspectRatio[] = ['1:1', '4:5', '9:16', '16:9']

/**
 * Kasane Studio アプリケーションシェル（scaffold / S1.1）。
 * 生成（Gemini）と配置・微調整（ローカルレイヤーキャンバス）を分離するレイアウトの骨組み。
 * 各パネル・キャンバスの中身は後続ストーリー（E2/E3/E4/E5/E6）で実装される。
 */
export default function App() {
  const [aspect, setAspect] = useState<AspectRatio>('1:1')
  const apiKey = useKasane((s) => s.apiKey)
  const hydrate = useKasane((s) => s.hydrate)

  // 起動時に IndexedDB から直近プロジェクトと API キーを復元（リロード後の状態回復）。
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const configured = Boolean(apiKey)

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__brand-mark">K</span>
          <span className="app__brand-name">Kasane Studio</span>
        </div>
        <nav className="app__aspect" aria-label="Aspect ratio">
          {ASPECTS.map((a) => (
            <button
              key={a}
              type="button"
              className={`chip ${a === aspect ? 'chip--active' : ''}`}
              onClick={() => setAspect(a)}
            >
              {a}
            </button>
          ))}
        </nav>
      </header>

      <main className="app__main">
        <aside className="app__sidebar app__sidebar--left">
          <StylePanel />
          {/* apiKey 未設定時は生成系 UI（AddPart）を無効化し、Settings への導線を出す */}
          <div className={`panel-lock-wrap${configured ? '' : ' is-locked'}`}>
            <AddPartPanel />
            {!configured && (
              <div className="panel-lock" role="alert">
                <p className="panel-lock__msg">API キー未設定</p>
                <a className="panel-lock__cta" href="#settings">
                  Settings で設定 →
                </a>
              </div>
            )}
          </div>
        </aside>

        <section className="app__stage">
          <CanvasStage aspect={aspect} />
        </section>

        <aside className="app__sidebar app__sidebar--right">
          <InspectorPanel />
          <LayersPanel />
          <SettingsPanel />
        </aside>
      </main>

      <footer className="app__footer">
        <span>生成と配置を分離する広告画像オーサリング — BYOK 設定 (S1.3 / dt-4n4.3)</span>
      </footer>
    </div>
  )
}
