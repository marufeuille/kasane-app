/**
 * SettingsPanel — BYOK（Bring Your Own Key）設定。
 *
 * Gemini API キーを IndexedDB にローカル保存（平文）し、モデル名 / プロキシ URL も
 * 任意で設定できる。平文保存になる点は UI 上で警告する（plan 確定方針）。
 *
 * acceptance（dt-4n4.3）:
 * - キー入力 → 保存 → リロード後も保持される（IndexedDB 永続化）
 * - 平文保存の警告文が表示される
 * - 未設定時は生成系 UI が無効化され、設定への導線が出る（App 側で apiKey で判定）
 *
 * API キーは store（生成系 UI の有効/無効判定に使うため state に持つ）。
 * モデル名 / プロキシ URL は生成時に client（S2.1 / dt-kd9.1）が db から読むので
 * ここでは UI ローカルで入力・保存する。
 */
import { useEffect, useState } from 'react'
import { useKasane } from '../state/store'
import { getModel, getProxyUrl, setModel, setProxyUrl } from '../db/db'
import { DEFAULT_MODEL } from '../types'

export default function SettingsPanel() {
  const apiKey = useKasane((s) => s.apiKey)
  const saveApiKey = useKasane((s) => s.saveApiKey)

  const [keyInput, setKeyInput] = useState('')
  const [reveal, setReveal] = useState(false)
  const [model, setModelValue] = useState(DEFAULT_MODEL)
  const [proxyUrl, setProxyUrlValue] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // 保存済み設定（apiKey/model/proxyUrl）を IndexedDB から読込。
  // apiKey は store 経由で配信されるため、apiKey 変化（初回復元 / 保存後）に再同期する。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [m, p] = await Promise.all([getModel(), getProxyUrl()])
      if (cancelled) return
      setKeyInput(apiKey ?? '')
      setModelValue(m && m.length > 0 ? m : DEFAULT_MODEL)
      setProxyUrlValue(p ?? '')
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [apiKey])

  const handleSave = async () => {
    await saveApiKey(keyInput.trim())
    await setModel(model.trim())
    await setProxyUrl(proxyUrl.trim())
    setSavedAt(Date.now())
  }

  return (
    <section className="panel settings" id="settings">
      <h2 className="panel__title">Settings</h2>

      <p className="settings__warning" role="alert">
        ⚠ API キーはこの端末の IndexedDB に<span className="settings__em">平文で保存</span>されます。
        共有端末では使用しないでください。
      </p>

      <div className="field">
        <label className="field__label" htmlFor="settings-apiKey">
          Gemini API キー
        </label>
        <div className="settings__keyrow">
          <input
            id="settings-apiKey"
            className="input"
            type={reveal ? 'text' : 'password'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setReveal((v) => !v)}
            aria-pressed={reveal}
          >
            {reveal ? '隠す' : '表示'}
          </button>
        </div>
        <span className="settings__status">
          {apiKey ? '（API キー設定済み）' : '（未設定 — 生成機能は無効です）'}
        </span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="settings-model">
          モデル名（任意）
        </label>
        <input
          id="settings-model"
          className="input"
          type="text"
          value={model}
          onChange={(e) => setModelValue(e.target.value)}
          placeholder={DEFAULT_MODEL}
          spellCheck={false}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="settings-proxy">
          プロキシ URL（任意・CORS 回避用）
        </label>
        <input
          id="settings-proxy"
          className="input"
          type="url"
          value={proxyUrl}
          onChange={(e) => setProxyUrlValue(e.target.value)}
          placeholder="https://your-worker.example.workers.dev/"
          spellCheck={false}
        />
      </div>

      <div className="settings__actions">
        <button
          type="button"
          className="btn"
          onClick={handleSave}
          disabled={!hydrated}
        >
          保存
        </button>
        {savedAt !== null && <span className="settings__saved">保存しました</span>}
      </div>
    </section>
  )
}
