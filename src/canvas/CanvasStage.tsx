import type { CSSProperties } from 'react'
import type { AspectRatio } from '../types'

const RATIO: Record<AspectRatio, string> = {
  '1:1': '1 / 1',
  '4:5': '4 / 5',
  '9:16': '9 / 16',
  '16:9': '16 / 9',
}

const LABEL: Record<AspectRatio, string> = {
  '1:1': '1:1 · Square',
  '4:5': '4:5 · Portrait',
  '9:16': '9:16 · Story',
  '16:9': '16:9 · Wide',
}

/**
 * CanvasStage（skeleton）— react-konva によるレイヤーキャンバスのルート。
 * 写真レイヤー描画・広告サイズプリセット反映・Transformer は
 * S3.1〜S3.2（dt-5ae 配下）で実装する。ここではアスペクト比に追従するプレースホルダー。
 */
export default function CanvasStage({ aspect = '1:1' }: { aspect?: AspectRatio }) {
  return (
    <div
      className="canvas-stage"
      style={{ '--stage-ratio': RATIO[aspect] } as CSSProperties}
    >
      <span className="canvas-stage__aspect">{LABEL[aspect]}</span>
      <div className="canvas-stage__placeholder">
        Konva Stage — S3.1 (dt-5ae)
      </div>
    </div>
  )
}
