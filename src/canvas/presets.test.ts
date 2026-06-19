import { describe, expect, it } from 'vitest'
import type { AspectRatio } from '../types'
import {
  ASPECT_LABELS,
  ASPECT_ORDER,
  CANVAS_PRESETS,
  canvasSizeFor,
  fitScale,
} from './presets'

const ALL_ASPECTS: AspectRatio[] = ['1:1', '4:5', '9:16', '16:9']

describe('CANVAS_PRESETS — 広告サイズプリセット', () => {
  it('全 AspectRatio の寸法が定義されている', () => {
    for (const a of ALL_ASPECTS) {
      expect(CANVAS_PRESETS[a]).toBeDefined()
      expect(CANVAS_PRESETS[a].width).toBeGreaterThan(0)
      expect(CANVAS_PRESETS[a].height).toBeGreaterThan(0)
    }
  })

  it('各アスペクト比が期待する広告寸法（1080 基準）になる', () => {
    expect(CANVAS_PRESETS['1:1']).toEqual({ width: 1080, height: 1080 })
    expect(CANVAS_PRESETS['4:5']).toEqual({ width: 1080, height: 1350 })
    expect(CANVAS_PRESETS['9:16']).toEqual({ width: 1080, height: 1920 })
    expect(CANVAS_PRESETS['16:9']).toEqual({ width: 1920, height: 1080 })
  })

  it('寸法はアスペクト比の比に一致する', () => {
    const ratio = (w: number, h: number) => w / h
    expect(ratio(CANVAS_PRESETS['1:1'].width, CANVAS_PRESETS['1:1'].height)).toBeCloseTo(1, 5)
    expect(ratio(CANVAS_PRESETS['4:5'].width, CANVAS_PRESETS['4:5'].height)).toBeCloseTo(4 / 5, 5)
    expect(ratio(CANVAS_PRESETS['9:16'].width, CANVAS_PRESETS['9:16'].height)).toBeCloseTo(9 / 16, 5)
    expect(ratio(CANVAS_PRESETS['16:9'].width, CANVAS_PRESETS['16:9'].height)).toBeCloseTo(16 / 9, 5)
  })

  it('ASPECT_ORDER は全アスペクト比を網羅し一意', () => {
    expect(ASPECT_ORDER).toEqual(ALL_ASPECTS)
    expect(new Set(ASPECT_ORDER).size).toBe(ASPECT_ORDER.length)
  })

  it('ASPECT_LABELS は全アスペクト比に空でないラベルを持つ', () => {
    for (const a of ALL_ASPECTS) {
      expect(ASPECT_LABELS[a].length).toBeGreaterThan(0)
    }
  })
})

describe('canvasSizeFor / fitScale', () => {
  it('canvasSizeFor は CANVAS_PRESETS と一致する', () => {
    expect(canvasSizeFor('9:16')).toEqual(CANVAS_PRESETS['9:16'])
  })

  it('fitScale は表示幅へ論理キャンバスを収めるスケールを返す', () => {
    expect(fitScale({ width: 1080, height: 1080 }, 540)).toBeCloseTo(0.5, 5)
  })

  it('fitScale は 0 以下の入力で 1 を返す（ゼロ除算回避）', () => {
    expect(fitScale({ width: 0, height: 0 }, 540)).toBe(1)
    expect(fitScale({ width: 1080, height: 1080 }, 0)).toBe(1)
  })
})
