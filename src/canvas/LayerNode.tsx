/**
 * Kasane Studio — 単一レイヤーの Konva 描画ノード。
 *
 * 判別共用体 Layer（photo / ai-part / text）を kind で分岐し、
 * react-konva の Image / Text として描画する。transform（位置・拡縮・回転・不透明度）を反映。
 *
 * S3.2（dt-5ae.2）の範囲:
 * - クリック/タップでレイヤーを選択（selectLayer）。
 * - 選択中レイヤーはドラッグで移動（onDragEnd → updateTransform）。
 * - 拡縮・回転は親（CanvasStage）の Transformer が担当。Transformer をアタッチするため、
 *   マウント時に Konva ノードを onNodeRef で親へ伝える。
 * - z 順は親が order 昇順で並べることで表現（後追加 = 前面）。
 */
import { useEffect, useState } from 'react'
import { Image as KonvaImage, Text as KonvaText } from 'react-konva'
import type Konva from 'konva'
import { useKasane } from '../state/store'
import type { AiPartLayer, ImageBlob, Layer, PhotoLayer, TextLayer } from '../types'

/** LayerNode の props。親（CanvasStage）から選択状態とノード参照コールバックを受ける。 */
export interface LayerNodeProps {
  layer: Layer
  /** 選択中か（Transformer 表示・ドラッグ可否の判定に使用）。 */
  selected: boolean
  /** Konva ノードがマウント/アンマウントされた時に呼ばれる（Transformer アタッチ用）。 */
  onNodeRef?: (node: Konva.Node | null) => void
}

/**
 * IndexedDB から画像 Blob をロードして保持する。
 * blobId が切り替わると再ロード。テキストレイヤー等では未使用。
 */
function useImageBlob(blobId: string | undefined): ImageBlob | undefined {
  const [blob, setBlob] = useState<ImageBlob>()
  const loadImageBlob = useKasane((s) => s.loadImageBlob)
  useEffect(() => {
    let active = true
    if (!blobId) {
      setBlob(undefined)
      return
    }
    void loadImageBlob(blobId).then((b) => {
      if (active) setBlob(b)
    })
    return () => {
      active = false
    }
  }, [blobId, loadImageBlob])
  return blob
}

/**
 * Blob から HTMLImageElement を生成し、Konva Image に渡せる形で保持。
 * ObjectURL はクリーンアップで revoke する（メモリリーク防止）。
 */
function useHtmlImage(blob: Blob | undefined): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement>()
  useEffect(() => {
    if (!blob) {
      setImg(undefined)
      return
    }
    const url = URL.createObjectURL(blob)
    const el = new Image()
    el.onload = () => setImg(el)
    el.onerror = () => setImg(undefined)
    el.src = url
    return () => {
      URL.revokeObjectURL(url)
      el.onload = null
      el.onerror = null
    }
  }, [blob])
  return img
}

/** fontWeight（数値）を Konva Text の fontStyle 文字列へ。600 以上を太字とみなす。 */
function fontStyleFor(fontWeight: number): 'normal' | 'bold' {
  return fontWeight >= 600 ? 'bold' : 'normal'
}

/** 写真 / AIパーツ（いずれも画像 Blob を参照）の描画。 */
function ImageLayerNode({
  layer,
  selected,
  onNodeRef,
}: {
  layer: PhotoLayer | AiPartLayer
  selected: boolean
  onNodeRef?: (node: Konva.Node | null) => void
}) {
  const selectLayer = useKasane((s) => s.selectLayer)
  const updateTransform = useKasane((s) => s.updateTransform)
  const imageBlob = useImageBlob(layer.blobId)
  const image = useHtmlImage(imageBlob?.blob)
  const { transform: t } = layer
  return (
    <KonvaImage
      ref={onNodeRef}
      image={image}
      x={t.x}
      y={t.y}
      width={t.width}
      height={t.height}
      rotation={t.rotation}
      opacity={t.opacity}
      // ブレンドモード（下位レイヤーとの合成）。Konva は globalCompositeOperation に反映。
      globalCompositeOperation={layer.blendMode}
      // 表示中はタップ/クリックで選択できるように listening する。
      // （背面レイヤーを覆う全面レイヤーが邪魔するのは自然な挙動）
      listening
      // 選択中のみ直接ドラッグ移動を許可（拡縮・回転は Transformer）。
      draggable={selected}
      onClick={() => selectLayer(layer.id)}
      onTap={() => selectLayer(layer.id)}
      onDragEnd={(e) => {
        const node = e.target
        void updateTransform(layer.id, { x: node.x(), y: node.y() })
      }}
    />
  )
}

/** 実フォントテキストの描画（テキスト両対応の実フォント側）。 */
function TextLayerNode({
  layer,
  selected,
  onNodeRef,
}: {
  layer: TextLayer
  selected: boolean
  onNodeRef?: (node: Konva.Node | null) => void
}) {
  const selectLayer = useKasane((s) => s.selectLayer)
  const updateTransform = useKasane((s) => s.updateTransform)
  const { transform: t } = layer
  return (
    <KonvaText
      ref={onNodeRef}
      text={layer.text}
      fontFamily={layer.fontFamily}
      fontSize={layer.fontSize}
      fontStyle={fontStyleFor(layer.fontWeight)}
      fill={layer.color}
      x={t.x}
      y={t.y}
      width={t.width}
      rotation={t.rotation}
      opacity={t.opacity}
      globalCompositeOperation={layer.blendMode}
      listening
      draggable={selected}
      onClick={() => selectLayer(layer.id)}
      onTap={() => selectLayer(layer.id)}
      onDragEnd={(e) => {
        const node = e.target
        void updateTransform(layer.id, { x: node.x(), y: node.y() })
      }}
    />
  )
}

/**
 * 単一レイヤーを描画。kind でノード種別を切り替える。
 * （acceptance: 複数レイヤーが z 順に描画される / 選択で Transformer 操作）
 */
export default function LayerNode({
  layer,
  selected,
  onNodeRef,
}: LayerNodeProps) {
  switch (layer.kind) {
    case 'photo':
      return (
        <ImageLayerNode
          layer={layer}
          selected={selected}
          onNodeRef={onNodeRef}
        />
      )
    case 'ai-part':
      return (
        <ImageLayerNode
          layer={layer}
          selected={selected}
          onNodeRef={onNodeRef}
        />
      )
    case 'text':
      return (
        <TextLayerNode
          layer={layer}
          selected={selected}
          onNodeRef={onNodeRef}
        />
      )
    default: {
      // 判別共用体を網羅した保証のための静的チェック。
      const _exhaustive: never = layer
      return _exhaustive
    }
  }
}
