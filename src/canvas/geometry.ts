/**
 * Kasane Studio — キャンバス配置の純粋計算（geometry）。
 *
 * DOM にも Konva にも依存しない純関数のみを置く。これにより
 * テスト環境（vitest / node）で描画なしに検証できる。
 * 画像の読込（Image / ObjectURL）等の副作用は CanvasStage 側に持つ。
 */
import type { Transform } from '../types'
import type { CanvasSize } from './presets'

/** フィット結果（キャンバス論理座標系での配置矩形）。 */
export interface FitRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * コンテンツ（写真等）を枠（キャンバス）へ cover フィットさせる。
 *
 * cover: コンテンツのアスペクト比を保ったまま枠を「完全に覆う」ように拡大縮小し、
 * はみ出し分はクリップされる（背景写真として全面を覆う用途）。
 * 中央寄せで配置する。
 *
 * @param contentW コンテンツの自然幅（px）
 * @param contentH コンテンツの自然高（px）
 * @param frame    枠（キャンバス）の論理寸法
 */
export function fitCover(
  contentW: number,
  contentH: number,
  frame: CanvasSize,
): FitRect {
  if (contentW <= 0 || contentH <= 0) {
    return { x: 0, y: 0, width: frame.width, height: frame.height }
  }
  const scale = Math.max(frame.width / contentW, frame.height / contentH)
  const width = contentW * scale
  const height = contentH * scale
  return {
    x: (frame.width - width) / 2,
    y: (frame.height - height) / 2,
    width,
    height,
  }
}

/**
 * 写真レイヤー追加時のデフォルト Transform を作る（cover フィット・不透明・無回転）。
 * CanvasStage が写真アップロード時に PhotoLayer.transform の起点として使用。
 */
export function coverTransform(
  contentW: number,
  contentH: number,
  frame: CanvasSize,
): Transform {
  const fit = fitCover(contentW, contentH, frame)
  return { ...fit, rotation: 0, opacity: 1 }
}
