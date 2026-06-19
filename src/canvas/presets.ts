/**
 * Kasane Studio — キャンバス広告サイズプリセット。
 *
 * 各アスペクト比（AspectRatio）を広告配信で使われる論理ピクセル寸法へ割り当てる。
 * S3.1（dt-5ae.1）の「サイズプリセット切替でキャンバス寸法が変わる」を受け持つ。
 *
 * 1080px を基準軸に、各比率で長辺・短辺を設定（plan 技術前提に準拠）。
 * Konva Stage はこの論理寸法で構成し、表示は CSS でコンテナへ fit させる。
 */
import type { AspectRatio } from '../types'

/** キャンバスの論理ピクセル寸法。 */
export interface CanvasSize {
  width: number
  height: number
}

/**
 * 広告サイズプリセット（論理ピクセル）。
 *
 * - 1:1  → 1080 × 1080 （フィード正方形）
 * - 4:5  → 1080 × 1350 （ポートレート）
 * - 9:16 → 1080 × 1920 （ストーリー / リール）
 * - 16:9 → 1920 × 1080 （ランドスケープ / 横長）
 */
export const CANVAS_PRESETS: Record<AspectRatio, CanvasSize> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
}

/** 全アスペクト比を UI（チップ等）の表示順で返す。 */
export const ASPECT_ORDER: AspectRatio[] = ['1:1', '4:5', '9:16', '16:9']

/** アスペクト比の表示ラベル（チップ・デモ用）。 */
export const ASPECT_LABELS: Record<AspectRatio, string> = {
  '1:1': '1:1 · Square',
  '4:5': '4:5 · Portrait',
  '9:16': '9:16 · Story',
  '16:9': '16:9 · Wide',
}

/** アスペクト比をプリセット寸法へ解決（未指定時は 1:1）。 */
export function canvasSizeFor(aspect: AspectRatio): CanvasSize {
  return CANVAS_PRESETS[aspect]
}

/**
 * 表示用スケールを計算する。論理キャンバスを与えられた表示幅へ収める。
 * CanvasStage がコンテナ幅に合わせて Stage を縮小表示する際に使用。
 */
export function fitScale(logical: CanvasSize, displayWidth: number): number {
  if (logical.width <= 0 || displayWidth <= 0) return 1
  return displayWidth / logical.width
}
