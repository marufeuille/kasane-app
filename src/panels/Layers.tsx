/**
 * LayersPanel — レイヤー一覧・並べ替え(z順)・表示切替・選択・リネーム・削除。
 *
 * 配置/移動/拡縮/回転/透過と同じく、これらの操作もローカル（store）で即時・無API。
 * store.layers は背面→前面（order 昇順）に保持されているため、UI では前面を上にするため
 * reverse して表示する（リストの上がより手前）。
 *
 * 設計上の選択:
 * - draft/保存パターンでなく、各操作を直接 store アクションへ繋ぐ（Inspector と同じ即時反映）。
 * - 選択はクリック（selectLayer）。リネームはダブルクリックでインライン編集（Enter/blur で確定・Esc で取消）。
 * - z 順の ↑/↓ は store の背面→前面 index を ±1 して reorderLayer へ（境界で disable）。
 *
 * acceptance（dt-5ae.4）:
 * - 全レイヤーが一覧表示される
 * - 並べ替えで z 順が変わる
 * - 表示/非表示・選択・削除ができる
 */
import { useEffect, useRef, useState } from 'react'
import { useKasane } from '../state/store'
import type { Layer, LayerKind } from '../types'

/** レイヤー種別の日本語ラベル（一覧のタグ表示用）。 */
const KIND_LABEL: Record<LayerKind, string> = {
  photo: '写真',
  'ai-part': 'パーツ',
  text: 'テキスト',
}

export default function LayersPanel() {
  const layers = useKasane((s) => s.layers)
  const selectedLayerId = useKasane((s) => s.selectedLayerId)
  const selectLayer = useKasane((s) => s.selectLayer)
  const removeLayer = useKasane((s) => s.removeLayer)
  const reorderLayer = useKasane((s) => s.reorderLayer)
  const updateLayer = useKasane((s) => s.updateLayer)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // 前面（order 大）をリスト上に表示するため、背面→前面の配列を反転。
  const ordered: Layer[] = [...layers].reverse()
  const count = layers.length

  // 編集開始時に即フォーカス（Enter/Esc での確定・取消をやりやすく）。
  useEffect(() => {
    if (editingId) nameInputRef.current?.focus()
  }, [editingId])

  /** リネーム編集を開始。 */
  const startRename = (layer: Layer): void => {
    setEditingId(layer.id)
    setDraftName(layer.name)
  }

  /** リネームを確定（空名は取消扱い）。 */
  const commitRename = async (): Promise<void> => {
    if (editingId !== null) {
      const name = draftName.trim()
      if (name) await updateLayer(editingId, { name })
    }
    setEditingId(null)
  }

  return (
    <section className="panel layers">
      <h2 className="panel__title">Layers</h2>
      <p className="panel__hint">一覧 · 並べ替え(z順) · 表示切替 · リネーム · 削除</p>

      {count === 0 ? (
        <p className="layers__empty">レイヤーがありません。キャンバスへ写真をドロップしてください。</p>
      ) : (
        <ul className="layers__list">
          {ordered.map((layer) => {
            // store 配列（背面=0）での index。↑/↓ の reorderLayer と disable 判定に使う。
            const storeIndex = layers.findIndex((l) => l.id === layer.id)
            const active = layer.id === selectedLayerId
            return (
              <li
                key={layer.id}
                className={`layers__item${active ? ' layers__item--active' : ''}`}
              >
                <button
                  type="button"
                  className="layers__vis"
                  onClick={() => void updateLayer(layer.id, { visible: !layer.visible })}
                  aria-pressed={layer.visible}
                  aria-label={layer.visible ? `${layer.name} を非表示` : `${layer.name} を表示`}
                  title={layer.visible ? '非表示' : '表示'}
                >
                  {layer.visible ? '👁' : 'ー'}
                </button>

                {editingId === layer.id ? (
                  <input
                    ref={nameInputRef}
                    className="input layers__name-input"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => void commitRename()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void commitRename()
                      } else if (e.key === 'Escape') {
                        setEditingId(null)
                      }
                    }}
                    aria-label="レイヤー名"
                  />
                ) : (
                  <button
                    type="button"
                    className="layers__name"
                    onClick={() => selectLayer(layer.id)}
                    onDoubleClick={() => startRename(layer)}
                    title="クリックで選択 / ダブルクリックでリネーム"
                  >
                    <span className="layers__kind">{KIND_LABEL[layer.kind]}</span>
                    <span className="layers__label">{layer.name}</span>
                  </button>
                )}

                <span className="layers__order">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => void reorderLayer(layer.id, storeIndex + 1)}
                    disabled={storeIndex >= count - 1}
                    aria-label={`${layer.name} を前面へ`}
                    title="前面へ"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => void reorderLayer(layer.id, storeIndex - 1)}
                    disabled={storeIndex <= 0}
                    aria-label={`${layer.name} を背面へ`}
                    title="背面へ"
                  >
                    ↓
                  </button>
                </span>

                <button
                  type="button"
                  className="btn btn--ghost btn--sm layers__del"
                  onClick={() => void removeLayer(layer.id)}
                  aria-label={`${layer.name} を削除`}
                  title="削除"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
