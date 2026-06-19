import { describe, expect, it } from 'vitest'
import { assembleStylePrompt, type PartSpec } from './prompt'
import { applyMoodPreset, defaultStyleSpec, getMoodPreset } from '../style/presets'
import type { StyleSpec } from '../types'

const part: PartSpec = { content: 'コーヒーカップ', role: 'メインビジュアル' }

describe('assembleStylePrompt — 決定論的（同じ入力 → 同じ出力）', () => {
  it('同じ入力からは常に同じプロンプトが出る', () => {
    const style: StyleSpec = { ...defaultStyleSpec(), brief: '温かみのある手描き風' }
    const a = assembleStylePrompt(style, part)
    // 別インスタンスの同等な引数で呼んでも一致する（参照同一性に依存しない）
    const b = assembleStylePrompt({ ...style, palette: [...style.palette] }, { ...part })
    expect(a).toBe(b)
  })

  it('内容が変わればプロンプトが変わる', () => {
    const style = defaultStyleSpec()
    const a = assembleStylePrompt(style, { content: 'コーヒーカップ', role: 'メイン' })
    const b = assembleStylePrompt(style, { content: '紅茶のカップ', role: 'メイン' })
    expect(a).not.toBe(b)
  })

  it('palette の並びが違えばプロンプトが変わる（順序保存 = 決定論的）', () => {
    const base = defaultStyleSpec()
    const a = assembleStylePrompt({ ...base, palette: ['#111111', '#222222'] }, part)
    const b = assembleStylePrompt({ ...base, palette: ['#222222', '#111111'] }, part)
    expect(a).not.toBe(b)
  })
})

describe('mood / palette / decoration の反映', () => {
  it('mood プリセット適用の StyleSpec で、テイスト/雰囲気/カラー/装飾がプロンプトに現れる', () => {
    const style: StyleSpec = { ...defaultStyleSpec(), ...applyMoodPreset('pop') }
    const out = assembleStylePrompt(style, part)
    expect(out).toContain(getMoodPreset('pop')!.label) // テイスト: ポップ
    expect(out).toContain(style.brief)
    expect(out).toContain(style.decoration)
    expect(out).toContain(style.typographyFeel)
    for (const c of style.palette) {
      expect(out).toContain(c)
    }
  })

  it('luxe / natural でもそれぞれのプリセット値が反映される', () => {
    for (const key of ['luxe', 'natural'] as const) {
      const style: StyleSpec = { ...defaultStyleSpec(), ...applyMoodPreset(key) }
      const out = assembleStylePrompt(style, part)
      expect(out).toContain(getMoodPreset(key)!.label)
      expect(out).toContain(style.brief)
    }
  })

  it('palette は入力順を保って " / " 区切りで結合される', () => {
    const style: StyleSpec = {
      ...defaultStyleSpec(),
      palette: ['#111111', '#222222', '#333333'],
    }
    expect(assembleStylePrompt(style, part)).toContain('カラー: #111111 / #222222 / #333333')
  })

  it('空の StyleSpec では雰囲気セクションを出さない（壊れない）', () => {
    const out = assembleStylePrompt(defaultStyleSpec(), part)
    expect(out).not.toContain('カラー:')
    expect(out).not.toContain('装飾:')
    expect(out).not.toContain('テイスト:')
    // 制約は StyleSpec が空でも常に出る
    expect(out).toContain('制約:')
  })
})

describe('言語', () => {
  it('language=ja で「日本語」指定', () => {
    const out = assembleStylePrompt({ ...defaultStyleSpec(), language: 'ja' }, part)
    expect(out).toContain('日本語')
  })

  it('language=en で「英語」指定', () => {
    const out = assembleStylePrompt({ ...defaultStyleSpec(), language: 'en' }, part)
    expect(out).toContain('英語')
  })

  it('未知の言語コードはそのまま言語名として出す', () => {
    const out = assembleStylePrompt({ ...defaultStyleSpec(), language: 'zh' }, part)
    expect(out).toContain('zh')
  })
})

describe('制約（description: 孤立した1要素・無地/透過背景・写真なし）', () => {
  it('孤立 / 無地 / 透明 / 写真なし の制約を常に含む', () => {
    const out = assembleStylePrompt(defaultStyleSpec(), part)
    expect(out).toContain('孤立')
    expect(out).toContain('無地')
    expect(out).toContain('透明')
    expect(out).toMatch(/写真/)
  })

  it('役割が空文字なら「役割:」行を出さない', () => {
    const out = assembleStylePrompt(defaultStyleSpec(), { content: 'バッジ', role: '' })
    expect(out).not.toMatch(/^役割:/m)
    expect(out).toContain('内容: バッジ')
  })

  it('役割の前後の空白はトリムされる（決定論性のため正規化）', () => {
    const a = assembleStylePrompt(defaultStyleSpec(), { content: 'x', role: '  メイン  ' })
    const b = assembleStylePrompt(defaultStyleSpec(), { content: 'x', role: 'メイン' })
    expect(a).toBe(b)
  })
})
