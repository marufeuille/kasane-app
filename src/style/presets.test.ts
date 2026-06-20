import { describe, expect, it } from 'vitest'
import {
  MOOD_PRESETS,
  applyMoodPreset,
  defaultStyleSpec,
  getMoodPreset,
  suggestTextFontFamily,
  suggestTextFontWeight,
  suggestTextColor,
  suggestTextStyle,
} from './presets'
import type { StyleSpec } from '../types'

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

describe('suggestTextFontFamily — typographyFeel からフォントを推論（dt-b9l.3）', () => {
  it('ゴシック系なら日本語ゴシックスタックを提案（ja）', () => {
    const s = suggestTextFontFamily('丸ゴシック・太字・遊び心のある組み', 'ja')
    expect(s).toContain('Hiragino Sans')
    expect(s).toContain('sans-serif')
  })

  it('セリフ/明朝なら明朝スタックを提案（ja）', () => {
    const s = suggestTextFontFamily('セリフ・細字〜中字・トラッキング広め', 'ja')
    expect(s).toContain('Hiragino Mincho')
    expect(s).toContain('serif')
  })

  it('手書き風なら筆記系スタックを提案', () => {
    const s = suggestTextFontFamily('手書き風・やさしい組み', 'ja')
    expect(s).toContain('cursive')
  })

  it('欧文（en）なら generic family にフォールバック', () => {
    expect(suggestTextFontFamily('bold sans headlines', 'en')).toBe(
      'system-ui, sans-serif',
    )
    expect(suggestTextFontFamily('elegant serif body', 'en')).toBe(
      'Georgia, "Times New Roman", serif',
    )
  })

  it('空の typographyFeel でも（ja 既定で）ゴシック系を返す', () => {
    expect(suggestTextFontFamily('', 'ja')).toContain('sans-serif')
  })
})

describe('suggestTextColor — palette からテキスト色を決定論的に選ぶ（dt-b9l.3）', () => {
  it('白系（背景）を除外した最初の色を選ぶ', () => {
    // luxe: ['#1A1A1A', '#C5A572', '#8C7853', '#F5F1E8', '#FFFFFF']
    expect(
      suggestTextColor(['#1A1A1A', '#C5A572', '#8C7853', '#F5F1E8', '#FFFFFF']),
    ).toBe('#1A1A1A')
  })

  it('先頭が白でも次の色を選ぶ', () => {
    expect(suggestTextColor(['#FFFFFF', '#FF6B6B', '#333333'])).toBe('#FF6B6B')
  })

  it('palette が空なら既定のテキスト色（DEFAULT_TEXT_COLOR）', () => {
    expect(suggestTextColor([])).toBe('#1A1A1A')
  })

  it('palette が白一色でも既定のテキスト色にフォールバック', () => {
    expect(suggestTextColor(['#FFFFFF', '#ffffff'])).toBe('#1A1A1A')
  })
})

describe('suggestTextFontWeight — 太さを推論（dt-b9l.3）', () => {
  it('「太字」を含むなら 700', () => {
    expect(suggestTextFontWeight('丸ゴシック・太字・遊び心のある組み')).toBe(700)
  })

  it('「太字」を含まないなら 400（通常）', () => {
    expect(suggestTextFontWeight('セリフ・細字〜中字')).toBe(400)
    expect(suggestTextFontWeight('')).toBe(400)
  })
})

describe('suggestTextStyle — フォント / 色 / 太さ を一括提案（dt-b9l.3）', () => {
  it('pop プリセット相当ならゴシック・太字(700)・palette 先頭色', () => {
    const style: StyleSpec = { ...defaultStyleSpec(), ...applyMoodPreset('pop') }
    const suggestion = suggestTextStyle(style)
    expect(suggestion.fontFamily).toContain('sans-serif')
    expect(suggestion.fontWeight).toBe(700)
    // pop の palette 先頭は #FF6B6B（白ではない）→ テキスト色候補
    expect(suggestion.color).toBe('#FF6B6B')
  })

  it('luxe プリセット相当なら明朝・通常(400)・palette 先頭色', () => {
    const style: StyleSpec = {
      ...defaultStyleSpec(),
      ...applyMoodPreset('luxe'),
    }
    const suggestion = suggestTextStyle(style)
    expect(suggestion.fontFamily).toContain('serif')
    expect(suggestion.fontWeight).toBe(400)
    // luxe palette 先頭は #1A1A1A
    expect(suggestion.color).toBe('#1A1A1A')
  })

  it('空の StyleSpec でも例外なく既定値を返す', () => {
    const suggestion = suggestTextStyle(defaultStyleSpec())
    expect(suggestion.fontFamily.length).toBeGreaterThan(0)
    expect(suggestion.color).toBe('#1A1A1A')
    expect(suggestion.fontWeight).toBe(400)
  })
})
