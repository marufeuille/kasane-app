import { describe, expect, it } from 'vitest'
import {
  MOOD_PRESETS,
  applyMoodPreset,
  defaultStyleSpec,
  getMoodPreset,
} from './presets'

describe('MOOD_PRESETS — プリセット定義', () => {
  it('ポップ / 高級 / ナチュラル を含む', () => {
    const keys = MOOD_PRESETS.map((p) => p.key)
    expect(keys).toEqual(expect.arrayContaining(['pop', 'luxe', 'natural']))
  })

  it('各プリセットは brief / palette / typographyFeel / decoration の初期値を持つ', () => {
    for (const p of MOOD_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.brief.length).toBeGreaterThan(0)
      expect(p.palette.length).toBeGreaterThan(0)
      expect(p.typographyFeel.length).toBeGreaterThan(0)
      expect(p.decoration.length).toBeGreaterThan(0)
    }
  })

  it('キーは一意', () => {
    const keys = MOOD_PRESETS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('getMoodPreset', () => {
  it('既知キーはプリセットを返す', () => {
    expect(getMoodPreset('pop')?.label).toBe('ポップ')
  })

  it('未知キーは undefined', () => {
    expect(getMoodPreset('does-not-exist')).toBeUndefined()
  })
})

describe('applyMoodPreset — moodプリセット選択で各フィールドに初期値が入る', () => {
  it('pop を選ぶと moodPreset + brief/palette/typographyFeel/decoration に初期値が入る', () => {
    const preset = getMoodPreset('pop')!
    const patch = applyMoodPreset('pop')
    expect(patch.moodPreset).toBe('pop')
    expect(patch.brief).toBe(preset.brief)
    expect(patch.palette).toEqual(preset.palette)
    expect(patch.typographyFeel).toBe(preset.typographyFeel)
    expect(patch.decoration).toBe(preset.decoration)
  })

  it('language / refLayerIds は上書きしない（ユーザー設定領域）', () => {
    const patch = applyMoodPreset('pop')
    expect(patch).not.toHaveProperty('language')
    expect(patch).not.toHaveProperty('refLayerIds')
  })

  it('未知キー / 空文字は未選択扱いで空の初期値', () => {
    expect(applyMoodPreset('unknown')).toEqual({
      moodPreset: '',
      brief: '',
      palette: [],
      typographyFeel: '',
      decoration: '',
    })
    expect(applyMoodPreset('')).toEqual({
      moodPreset: '',
      brief: '',
      palette: [],
      typographyFeel: '',
      decoration: '',
    })
  })
})

describe('palette — パレットが保持される', () => {
  it('プリセットの palette が HEX 配列としてそのまま入る', () => {
    const preset = getMoodPreset('luxe')!
    expect(applyMoodPreset('luxe').palette).toEqual(preset.palette)
    // HEX 形式を満たす
    for (const c of preset.palette) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('返す palette はプリセット配列のコピー（呼び出し間で参照を共有しない）', () => {
    const a = applyMoodPreset('pop').palette!
    const b = applyMoodPreset('pop').palette!
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    a.push('#000000')
    expect(b).not.toContain('#000000')
  })
})

describe('defaultStyleSpec', () => {
  it('全フィールドを空/既定値で持つ完全な StyleSpec', () => {
    const s = defaultStyleSpec()
    expect(s).toEqual({
      moodPreset: '',
      brief: '',
      palette: [],
      typographyFeel: '',
      decoration: '',
      language: 'ja',
      refLayerIds: [],
    })
  })

  it('呼び出しごとに新しい配列を返す（参照共有しない）', () => {
    const a = defaultStyleSpec()
    const b = defaultStyleSpec()
    expect(a).toEqual(b)
    expect(a.palette).not.toBe(b.palette)
    expect(a.refLayerIds).not.toBe(b.refLayerIds)
    a.palette.push('#111')
    a.refLayerIds.push('x')
    expect(b.palette).toEqual([])
    expect(b.refLayerIds).toEqual([])
  })
})
