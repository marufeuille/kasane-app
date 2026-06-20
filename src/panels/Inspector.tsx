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
import type { BlendMode, TextAlign, TextLayer } from '../types'

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

/** テキストレイヤーのフォント候補（CSS font-family スタック）。suggestTextStyle の出力と一致する値を含む。 */
const FONT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  {
    value: '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif',
    label: 'ゴシック（日本語）',
  },
  {
    value: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
    label: '明朝（日本語）',
  },
  {
    value: '"Hiragino Maru Gothic Pro", "Yu Gyosho", "Noto Sans JP", cursive',
    label: '手書き風（日本語）',
  },
  { value: 'system-ui, sans-serif', label: 'Sans（欧文）' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Serif（欧文）' },
  { value: 'ui-monospace, monospace', label: '等幅' },
]

/** フォントの太さ候補。fontStyleFor は 600 以上を太字とみなすため 400 / 700 の 2 段。 */
const WEIGHT_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 400, label: '通常' },
  { value: 700, label: '太字' },
]

/** テキストの水平揃え候補（TextAlign 全候補）。 */
const ALIGN_OPTIONS: ReadonlyArray<{ value: TextAlign; label: string }> = [
  { value: 'left', label: '左' },
  { value: 'center', label: '中央' },
  { value: 'right', label: '右' },
]

/** input[type=color] は #RRGGBB（6 桁）必須。それ以外はフォールバックで黒を返す。 */
function toColorValue(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#000000'
}

/**
 * テキストレイヤー専用のプロパティ編集（内容 / フォント / サイズ / 色 / 太さ / 揃え）。
 * 変更は即時 updateLayer 経由で IndexedDB に永続化（共通フィールド群と同じく「保存」ボタンなし）。
 * acceptance（dt-b9l.3）: 内容・フォント・色（＋サイズ・太さ・揃え）を編集できる。
 */
function TextLayerFields({ layer }: { layer: TextLayer }) {
  const updateLayer = useKasane((s) => s.updateLayer)
  const fontKnown = FONT_OPTIONS.some((o) => o.value === layer.fontFamily)
  return (
    <>
      {/* 内容（textarea → 即時 updateLayer） */}
      <div className="field">
        <label className="field__label" htmlFor="inspector-text">
          テキスト
        </label>
        <textarea
          id="inspector-text"
          className="input inspector__textarea"
          rows={2}
          value={layer.text}
          aria-label="テキスト内容"
          onChange={(e) => void updateLayer(layer.id, { text: e.target.value })}
        />
      </div>

      {/* フォント + サイズ（横並び） */}
      <div className="field inspector__row2">
        <div className="inspector__col">
          <label className="field__label" htmlFor="inspector-font">
            フォント
          </label>
          <select
            id="inspector-font"
            className="input"
            value={fontKnown ? layer.fontFamily : '__custom__'}
            aria-label="フォント"
            onChange={(e) => {
              if (e.target.value !== '__custom__')
                void updateLayer(layer.id, { fontFamily: e.target.value })
            }}
          >
            {!fontKnown && <option value="__custom__">（カスタム）</option>}
            {FONT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="inspector__col inspector__col--narrow">
          <label className="field__label" htmlFor="inspector-size">
            サイズ
          </label>
          <input
            id="inspector-size"
            className="input"
            type="number"
            min={1}
            value={layer.fontSize}
            aria-label="フォントサイズ"
            onChange={(e) =>
              void updateLayer(layer.id, {
                fontSize: Math.max(1, Math.round(Number(e.target.value)) || 1),
              })
            }
          />
        </div>
      </div>

      {/* 色（color picker + HEX 直入力 → 即時 updateLayer） */}
      <div className="field">
        <div className="field__row">
          <label className="field__label" htmlFor="inspector-color">
            色
          </label>
          <span className="field__value">{layer.color.toUpperCase()}</span>
        </div>
        <div className="inspector__colorrow">
          <input
            id="inspector-color"
            className="inspector__color"
            type="color"
            value={toColorValue(layer.color)}
            aria-label="テキストの色"
            onChange={(e) => void updateLayer(layer.id, { color: e.target.value })}
          />
          <input
            className="input inspector__hex"
            type="text"
            value={layer.color}
            aria-label="テキストの色（HEX）"
            onChange={(e) => void updateLayer(layer.id, { color: e.target.value })}
          />
        </div>
      </div>

      {/* 太さ + 揃え（横並び） */}
      <div className="field inspector__row2">
        <div className="inspector__col">
          <label className="field__label" htmlFor="inspector-weight">
            太さ
          </label>
          <select
            id="inspector-weight"
            className="input"
            value={
              WEIGHT_OPTIONS.some((o) => o.value === layer.fontWeight)
                ? layer.fontWeight
                : 400
            }
            aria-label="太さ"
            onChange={(e) =>
              void updateLayer(layer.id, { fontWeight: Number(e.target.value) })
            }
          >
            {WEIGHT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="inspector__col">
          <span className="field__label">揃え</span>
          <div className="segmented" role="group" aria-label="揃え">
            {ALIGN_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`segmented__btn${layer.align === o.value ? ' is-active' : ''}`}
                aria-pressed={layer.align === o.value}
                onClick={() => void updateLayer(layer.id, { align: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

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

      {selected.kind === 'text' && <TextLayerFields layer={selected} />}

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
