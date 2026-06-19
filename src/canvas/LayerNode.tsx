/**
 * Kasane Studio — 単一レイヤーの Konva 描画ノード。
 *
 * 判別共用体 Layer（photo / ai-part / text）を kind で分岐し、
 * react-konva の Image / Text として描画する。transform（位置・拡縮・回転・不透明度）を反映。
 *
 * S3.1（dt-5ae.1）の範囲:
 * - z 順は親（CanvasStage）が order 昇順で並べることで表現（後追加 = 前面）。
 * - 配置・移動・拡縮・回転のインタラクション（Transformer）は S3.2 で追加するため、
 *   ここでは listening={false} でイベントを握らず、Stage のタッチ操作が破綻しないようにする。
 */
import { useEffect, useState } from 'react'
import { Image as KonvaImage, Text as KonvaText } from 'react-konva'
import { useKasane } from '../state/store'
import type { AiPartLayer, ImageBlob, Layer, PhotoLayer, TextLayer } from '../types'

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
function ImageLayerNode({ layer }: { layer: PhotoLayer | AiPartLayer }) {
  const imageBlob = useImageBlob(layer.blobId)
  const image = useHtmlImage(imageBlob?.blob)
  const { transform: t } = layer
  return (
    <KonvaImage
      image={image}
      x={t.x}
      y={t.y}
      width={t.width}
      height={t.height}
      rotation={t.rotation}
      opacity={t.opacity}
      listening={false}
    />
  )
}

/** 実フォントテキストの描画（テキスト両対応の実フォント側）。 */
function TextLayerNode({ layer }: { layer: TextLayer }) {
  const { transform: t } = layer
  return (
    <KonvaText
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
      listening={false}
    />
  )
}

/**
 * 単一レイヤーを描画。kind でノード種別を切り替える。
 * （acceptance: 複数レイヤーが z 順に正しく描画される）
 */
export default function LayerNode({ layer }: { layer: Layer }) {
  switch (layer.kind) {
    case 'photo':
      return <ImageLayerNode layer={layer} />
    case 'ai-part':
      return <ImageLayerNode layer={layer} />
    case 'text':
      return <TextLayerNode layer={layer} />
    default: {
      // 判別共用体を網羅した保証のための静的チェック。
      const _exhaustive: never = layer
      return _exhaustive
    }
  }
}
