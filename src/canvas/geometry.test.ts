import { describe, expect, it } from 'vitest'
import { bakeScale, coverTransform, fitCover } from './geometry'

describe('fitCover — cover フィット計算', () => {
  it('同アスペクト比なら枠いっぱいに一致する', () => {
    const r = fitCover(1080, 1080, { width: 1080, height: 1080 })
    expect(r).toEqual({ x: 0, y: 0, width: 1080, height: 1080 })
  })

  it('横長コンテンツを縦長枠に cover フィット（高さ基準で拡大、左右クリップ）', () => {
    // 2000x1000 の写真を 1080x1920（9:16）へ。scale = max(1080/2000, 1920/1000) = 1.92
    const r = fitCover(2000, 1000, { width: 1080, height: 1920 })
    expect(r.width).toBeCloseTo(2000 * 1.92, 5) // 3840
    expect(r.height).toBeCloseTo(1000 * 1.92, 5) // 1920
    // 高さは枠に一致、幅がはみ出し → x は負（中央寄せ）
    expect(r.y).toBeCloseTo(0, 5)
    expect(r.x).toBeCloseTo((1080 - 3840) / 2, 5)
  })

  it('縦長コンテンツを横長枠に cover フィット（幅基準で拡大、上下クリップ）', () => {
    // 1000x2000 の写真を 1920x1080（16:9）へ。scale = max(1920/1000, 1080/2000) = 1.92
    const r = fitCover(1000, 2000, { width: 1920, height: 1080 })
    expect(r.width).toBeCloseTo(1000 * 1.92, 5) // 1920
    expect(r.height).toBeCloseTo(2000 * 1.92, 5) // 3840
    expect(r.x).toBeCloseTo(0, 5)
    expect(r.y).toBeCloseTo((1080 - 3840) / 2, 5)
  })

  it('cover なので結果矩形は枠を完全に覆う（幅・高さとも枠以上）', () => {
    const frame = { width: 1080, height: 1350 }
    const r = fitCover(3000, 3000, frame)
    expect(r.width).toBeGreaterThanOrEqual(frame.width)
    expect(r.height).toBeGreaterThanOrEqual(frame.height)
    // 枠内の任意点がコンテンツで覆われていることを、矩形が枠を囲むことで担保
    expect(r.x).toBeLessThanOrEqual(0)
    expect(r.y).toBeLessThanOrEqual(0)
    expect(r.x + r.width).toBeGreaterThanOrEqual(frame.width)
    expect(r.y + r.height).toBeGreaterThanOrEqual(frame.height)
  })

  it('コンテンツ寸法が 0 以下なら枠全体を返す（フォールバック）', () => {
    expect(fitCover(0, 0, { width: 1080, height: 1080 })).toEqual({
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
    })
  })
})

describe('coverTransform — 写真レイヤー追加時の初期 Transform', () => {
  it('fitCover の矩形に rotation=0 / opacity=1 を持つ', () => {
    const t = coverTransform(2000, 1000, { width: 1080, height: 1920 })
    expect(t.rotation).toBe(0)
    expect(t.opacity).toBe(1)
    expect(t.width).toBeCloseTo(3840, 5)
    expect(t.height).toBeCloseTo(1920, 5)
  })
})

describe('bakeScale — Transformer リサイズの寸法焼き込み', () => {
  it('scaleX/scaleY を width/height に乗算する', () => {
    // 1000x1000 を 1.5 倍 → 1500x1500
    expect(bakeScale(1000, 1000, 1.5, 1.5)).toEqual({
      width: 1500,
      height: 1500,
    })
  })

  it('縦横別々のスケールを反映する（自由変形）', () => {
    // 800x600 を 横1.25 / 縦0.5 → 1000x300
    expect(bakeScale(800, 600, 1.25, 0.5)).toEqual({
      width: 1000,
      height: 300,
    })
  })

  it('縮小（scale < 1）も寸法に反映する', () => {
    expect(bakeScale(1080, 1080, 0.5, 0.5)).toEqual({
      width: 540,
      height: 540,
    })
  })

  it('0 や負の寸法は最小 1px にクリップされる（描画消失防止）', () => {
    expect(bakeScale(1000, 1000, 0, 0)).toEqual({ width: 1, height: 1 })
    expect(bakeScale(1000, 1000, -2, 0.5)).toEqual({ width: 1, height: 500 })
  })
})
