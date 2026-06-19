/**
 * StylePanel — 雰囲気（StyleSpec）の編集 UI（E4 スタイル統一の中核入口）。
 *
 * mood プリセットを選ぶと brief / palette / typographyFeel / decoration に決定論的な
 * 初期値が入り（style/presets.ts の applyMoodPreset）、各フィールドをさらに編集できる。
 * 「保存」で project.styleSpec へ反映され、以後のパーツ生成（assembleStylePrompt）に
 * 同じ雰囲気が注入される = プロンプトガチャを消す。
 *
 * 設計上の選択:
 * - 編集はローカル draft で行い「保存」で確定する（SettingsPanel と同じ明示保存パターン）。
 * - mood プリセットは出発点。選ぶと brief/palette/typographyFeel/decoration を上書きするが、
 *   language / refLayerIds はユーザー設定領域なので保持する（applyMoodPreset がこれらを
 *   返さないため、draft へのマージで維持される — presets.test.ts で保証済み）。
 *
 * acceptance（dt-tud.2）:
 * - brief / プリセット / パレットを編集・保存できる
 * - 変更が StyleSpec に反映され以後の生成に使われる（setStyleSpec → assembleStylePrompt）
 */
import { useEffect, useState } from 'react'
import { useKasane } from '../state/store'
import { MOOD_PRESETS, applyMoodPreset, defaultStyleSpec } from '../style/presets'
import { DEFAULT_LANGUAGE, type StyleSpec } from '../types'

/** テキスト言語の選択肢（StyleSpec.language 用）。assembleStylePrompt が対応言語として展開する。 */
const LANGUAGES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: '英語' },
]

/** type=color に渡せる形式へ正規化（#rrggbb 以外は黒）。 */
function normalizeHex(hex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#000000'
}

export default function StylePanel() {
  const project = useKasane((s) => s.project)
  const setStyleSpec = useKasane((s) => s.setStyleSpec)
  const createProject = useKasane((s) => s.createProject)

  const [draft, setDraft] = useState<StyleSpec>(defaultStyleSpec())
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // プロジェクト切替（復元・新規作成）時に draft を実 StyleSpec へ同期。
  // 保存時の styleSpec 参照変化では再同期しない（draft は既にその値なので入力が飛ばない）。
  useEffect(() => {
    if (project) setDraft(project.styleSpec)
  }, [project?.id])

  // プロジェクト未作成時: スタイル編集の前提となるプロジェクトを作成して開始。
  // （全体的なプロジェクト新規作成 UX は別ストーリーで整理想定。ここでは本ストーリーの
  //   受け入れ条件を自己完結で確認できるよう、最低限の導線を置く。）
  if (!project) {
    return (
      <section className="panel style">
        <h2 className="panel__title">Style</h2>
        <p className="panel__hint">
          雰囲気（mood / palette / brief）を一度設定し、全パーツ生成に注入します。
        </p>
        <div className="style__actions">
          <button type="button" className="btn" onClick={() => void createProject()}>
            プロジェクトを作成して開始
          </button>
        </div>
      </section>
    )
  }

  /** mood プリセット選択: brief/palette/typographyFeel/decoration を初期値で上書き（language/refLayerIds は保持）。 */
  const pickMood = (key: string): void => {
    setDraft((d) => ({ ...d, ...applyMoodPreset(key) }))
  }

  /** palette[i] を hex で更新。 */
  const setPaletteColor = (i: number, hex: string): void => {
    setDraft((d) => {
      const palette = d.palette.slice()
      palette[i] = hex
      return { ...d, palette }
    })
  }

  /** palette 末尾に既定色を追加。 */
  const addPaletteColor = (): void => {
    setDraft((d) => ({ ...d, palette: [...d.palette, '#FFFFFF'] }))
  }

  /** palette[i] を削除。 */
  const removePaletteColor = (i: number): void => {
    setDraft((d) => ({ ...d, palette: d.palette.filter((_, idx) => idx !== i) }))
  }

  /** draft を project.styleSpec へ保存（setStyleSpec が updatedAt を進めて DB へ永続化）。 */
  const handleSave = async (): Promise<void> => {
    await setStyleSpec(draft)
    setSavedAt(Date.now())
  }

  const language = draft.language || DEFAULT_LANGUAGE

  return (
    <section className="panel style">
      <h2 className="panel__title">Style</h2>
      <p className="panel__hint">
        雰囲気を一度設定すると、以後のパーツ生成すべてに同じテイストが注入されます。
      </p>

      {/* mood プリセット */}
      <div className="field">
        <span className="field__label">ムード（プリセット）</span>
        <div className="style__chips" role="group" aria-label="Mood preset">
          <button
            type="button"
            className={`chip ${draft.moodPreset === '' ? 'chip--active' : ''}`}
            onClick={() => pickMood('')}
            aria-pressed={draft.moodPreset === ''}
          >
            なし
          </button>
          {MOOD_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`chip ${draft.moodPreset === p.key ? 'chip--active' : ''}`}
              onClick={() => pickMood(p.key)}
              aria-pressed={draft.moodPreset === p.key}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* brief */}
      <div className="field">
        <label className="field__label" htmlFor="style-brief">
          雰囲気ブリーフ
        </label>
        <input
          id="style-brief"
          className="input"
          type="text"
          value={draft.brief}
          onChange={(e) => setDraft((d) => ({ ...d, brief: e.target.value }))}
          placeholder="例: 親しみやすく元気な、明るい雰囲気"
        />
      </div>

      {/* palette */}
      <div className="field">
        <span className="field__label">カラーパレット</span>
        <ul className="palette">
          {draft.palette.map((hex, i) => (
            <li className="palette__row" key={i}>
              <input
                className="palette__swatch"
                type="color"
                value={normalizeHex(hex)}
                onChange={(e) => setPaletteColor(i, e.target.value)}
                aria-label={`Color ${i + 1}`}
              />
              <input
                className="input palette__hex"
                type="text"
                value={hex}
                onChange={(e) => setPaletteColor(i, e.target.value)}
                spellCheck={false}
              />
              <button
                type="button"
                className="btn btn--ghost btn--sm palette__remove"
                onClick={() => removePaletteColor(i)}
                aria-label={`Delete color ${i + 1}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn--ghost btn--sm" onClick={addPaletteColor}>
          + 色を追加
        </button>
      </div>

      {/* typographyFeel */}
      <div className="field">
        <label className="field__label" htmlFor="style-typo">
          タイポグラフィ
        </label>
        <input
          id="style-typo"
          className="input"
          type="text"
          value={draft.typographyFeel}
          onChange={(e) => setDraft((d) => ({ ...d, typographyFeel: e.target.value }))}
          placeholder="例: 丸ゴシック・太字・遊び心のある組み"
        />
      </div>

      {/* decoration */}
      <div className="field">
        <label className="field__label" htmlFor="style-decoration">
          装飾
        </label>
        <input
          id="style-decoration"
          className="input"
          type="text"
          value={draft.decoration}
          onChange={(e) => setDraft((d) => ({ ...d, decoration: e.target.value }))}
          placeholder="例: ポップなイラスト・吹き出し・小物"
        />
      </div>

      {/* language */}
      <div className="field">
        <span className="field__label">テキストの言語</span>
        <div className="style__chips" role="group" aria-label="Text language">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              type="button"
              className={`chip ${language === l.value ? 'chip--active' : ''}`}
              onClick={() => setDraft((d) => ({ ...d, language: l.value }))}
              aria-pressed={language === l.value}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* save */}
      <div className="style__actions">
        <button type="button" className="btn" onClick={handleSave}>
          保存
        </button>
        {savedAt !== null && <span className="style__saved">保存しました</span>}
      </div>
    </section>
  )
}
