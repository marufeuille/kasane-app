/**
 * InspectorPanel — 選択レイヤーのプロパティを即時（無API）で編集する。
 *
 * S3.3（dt-5ae.3）の範囲:
 * - 不透明度スライダ → updateTransform({ opacity })（透過が即時反映）
 * - ブレンドモード選択 → updateLayer({ blendMode })（Konva globalCompositeOperation に反映）
 * - z 順序（最背面 / 背面 / 前面 / 最前面） → reorderLayer（order 再採番して永続化）
 *
 * 編集は即座に store 経由で IndexedDB に永続化されるため「保存」ボタンは持たない
 * （StylePanel の明示保存パターンと異なり、レイヤー微調整はリアルタイム反映が前提）。
 * selectedLayer() は get() ベースでリアクティブでないため、layers / selectedLayerId を
 * 個別に subscribe して派生させる。
 *
 * acceptance（dt-5ae.3）:
 * - 不透明度スライダで透過が即時反映される
 * - ブレンドモードを変更できる
 * - z順を前後に移動できる
 * - 値が保存される（store → IndexedDB 永続化）
 */
import { useKasane } from '../state/store'
import type { BlendMode } from '../types'

/** ブレンドモードの選択肢（BlendMode 全候補を網羅）。Photoshop 風の分類で表示。 */
const BLEND_OPTIONS: ReadonlyArray<{ value: BlendMode; label: string }> = [
  { value: 'source-over', label: '通常' },
  { value: 'multiply', label: '乗算' },
  { value: 'screen', label: 'スクリーン' },
  { value: 'overlay', label: 'オーバーレイ' },
  { value: 'darken', label: '比較（暗）' },
  { value: 'lighten', label: '比較（明）' },
  { value: 'color-dodge', label: '覆い焼き（カラー）' },
  { value: 'color-burn', label: '焼き込み（カラー）' },
  { value: 'hard-light', label: 'ハードライト' },
  { value: 'soft-light', label: 'ソフトライト' },
  { value: 'difference', label: '差の絶対値' },
  { value: 'exclusion', label: '除外' },
  { value: 'hue', label: '色相' },
  { value: 'saturation', label: '彩度' },
  { value: 'color', label: 'カラー' },
  { value: 'luminosity', label: '輝度' },
  { value: 'lighter', label: '加算（発光）' },
  { value: 'destination-in', label: 'マスク（下で切り抜き）' },
]

export default function InspectorPanel() {
  const layers = useKasane((s) => s.layers)
  const selectedLayerId = useKasane((s) => s.selectedLayerId)
  const updateTransform = useKasane((s) => s.updateTransform)
  const updateLayer = useKasane((s) => s.updateLayer)
  const reorderLayer = useKasane((s) => s.reorderLayer)

  // layers は背面→前面（order 昇順）。index 0 = 最背面、末尾 = 最前面。
  const index = selectedLayerId
    ? layers.findIndex((l) => l.id === selectedLayerId)
    : -1
  const selected = index >= 0 ? layers[index] : null

  // 未選択時: キャンバスでレイヤーを選ぶよう誘導。
  if (!selected) {
    return (
      <section className="panel">
        <h2 className="panel__title">Inspector</h2>
        <p className="panel__hint">
          レイヤーを選ぶと不透明度・ブレンド・z順を編集できます（移動／拡縮／回転はキャンバスで）。
        </p>
      </section>
    )
  }

  const { transform: t, blendMode } = selected
  const opacityPct = Math.round(t.opacity * 100)
  const isFirst = index === 0
  const isLast = index === layers.length - 1

  return (
    <section className="panel inspector">
      <h2 className="panel__title">Inspector</h2>
      <p className="panel__hint">{selected.name}</p>

      {/* 不透明度（透過）: range → 即時 updateTransform */}
      <div className="field">
        <div className="field__row">
          <label className="field__label" htmlFor="inspector-opacity">
            不透明度
          </label>
          <span className="field__value">{opacityPct}%</span>
        </div>
        <input
          id="inspector-opacity"
          className="inspector__slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={opacityPct}
          aria-label="不透明度"
          onChange={(e) => {
            void updateTransform(selected.id, {
              opacity: Number(e.target.value) / 100,
            })
          }}
        />
      </div>

      {/* ブレンドモード: select → 即時 updateLayer */}
      <div className="field">
        <label className="field__label" htmlFor="inspector-blend">
          ブレンド
        </label>
        <select
          id="inspector-blend"
          className="input"
          value={blendMode}
          aria-label="ブレンドモード"
          onChange={(e) => {
            void updateLayer(selected.id, {
              blendMode: e.target.value as BlendMode,
            })
          }}
        >
          {BLEND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* z 順序: 最背面 / 背面 / 前面 / 最前面 → reorderLayer */}
      <div className="field">
        <span className="field__label">z 順序</span>
        <div className="inspector__zorder">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={isFirst}
            onClick={() => void reorderLayer(selected.id, 0)}
          >
            最背面
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={isFirst}
            onClick={() => void reorderLayer(selected.id, index - 1)}
          >
            背面へ
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={isLast}
            onClick={() => void reorderLayer(selected.id, index + 1)}
          >
            前面へ
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={isLast}
            onClick={() => void reorderLayer(selected.id, layers.length - 1)}
          >
            最前面
          </button>
        </div>
      </div>
    </section>
  )
}
