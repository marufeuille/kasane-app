/**
 * Kasane Studio — レイヤーキャンバスのルート（react-konva Stage/Layer）。
 *
 * S3.1（dt-5ae.1）: Stage/Layer 構築・広告サイズプリセット・写真ベースレイヤー表示・z 順描画。
 * S3.2（dt-5ae.2）: 選択レイヤーへの Konva Transformer 付与。
 * - ドラッグで移動（LayerNode の draggable + onDragEnd）。
 * - ハンドルで拡縮・回転（Transformer の onTransformEnd → updateTransform）。
 * - 選択ノードを Transformer にアタッチ／解除、背景タップで選択解除。
 * - 表示スケール（scale）の逆数でハンドル寸法を補正し、iPad タッチでも操作しやすく保つ。
 *
 * 変更は store（updateTransform）経由で IndexedDB に永続化 → リロード後も保持される。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import {
  Layer as KonvaLayer,
  Stage,
  Transformer as KonvaTransformer,
} from 'react-konva'
import type Konva from 'konva'
import { useKasane, genId } from '../state/store'
import { canvasSizeFor, ASPECT_LABELS } from './presets'
import { coverTransform, bakeScale } from './geometry'
import LayerNode from './LayerNode'
import type { AspectRatio, ImageBlob, PhotoLayer } from '../types'

/** 画像ファイルの自然寸法を取得（DOM Image 経由）。失敗時は 0x0。 */
function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => {
      resolve({ width: el.naturalWidth, height: el.naturalHeight })
      URL.revokeObjectURL(url)
    }
    el.onerror = () => {
      resolve({ width: 0, height: 0 })
      URL.revokeObjectURL(url)
    }
    el.src = url
  })
}

export default function CanvasStage() {
  const project = useKasane((s) => s.project)
  const layers = useKasane((s) => s.layers)
  const selectedLayerId = useKasane((s) => s.selectedLayerId)
  const addLayer = useKasane((s) => s.addLayer)
  const selectLayer = useKasane((s) => s.selectLayer)
  const updateTransform = useKasane((s) => s.updateTransform)
  const saveImageBlob = useKasane((s) => s.saveImageBlob)

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** Transformer 本体への参照（選択ノードのアタッチに使用）。 */
  const transformerRef = useRef<Konva.Transformer>(null)
  /** layerId → Konva ノード のレジストリ（LayerNode の onNodeRef で登録）。 */
  const nodeRegistry = useRef<Map<string, Konva.Node>>(new Map())
  const [scale, setScale] = useState(0)
  const [dragging, setDragging] = useState(false)

  const aspect: AspectRatio = project?.aspectRatio ?? '1:1'
  const dimensions = canvasSizeFor(aspect)

  // コンテナ（表示領域）に論理キャンバスを収める表示スケールを計算。
  // Stage の width/height には「表示サイズ」を渡し、scaleX/scaleY で内容を縮小する。
  // これで canvas 要素の実サイズが表示サイズになり、レイヤー座標系は論理のまま扱える。
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = (): void => {
      const { width, height } = el.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      const padding = 24 // 上下左右の観察用余白
      const availW = Math.max(0, width - padding)
      const availH = Math.max(0, height - padding)
      setScale(
        Math.min(availW / dimensions.width, availH / dimensions.height),
      )
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [dimensions.width, dimensions.height])

  // 選択中レイヤーのノードを Transformer にアタッチ（選択解除で外す）。
  // layers が変わる（追加/削除/順序変更）毎に再アタッチし、古いノード参照を外さない。
  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return
    const node = selectedLayerId
      ? nodeRegistry.current.get(selectedLayerId)
      : undefined
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selectedLayerId, layers])

  /** 写真ファイルをベースレイヤー（PhotoLayer）として追加。 */
  const addPhotoFromFile = useCallback(
    async (file: File): Promise<void> => {
      if (!project) return
      const dims = await readImageDimensions(file)
      const blobId = genId()
      const image: ImageBlob = {
        id: blobId,
        blob: file,
        mimeType: file.type || 'image/png',
        width: dims.width,
        height: dims.height,
        createdAt: Date.now(),
      }
      await saveImageBlob(image)
      const photo: PhotoLayer = {
        id: genId(),
        projectId: project.id,
        kind: 'photo',
        name: file.name || 'Photo',
        visible: true,
        order: 0, // addLayer が末尾（最前面）へ再採番
        transform: coverTransform(dims.width, dims.height, dimensions),
        blobId,
      }
      await addLayer(photo)
      selectLayer(photo.id)
    },
    [project, dimensions, addLayer, selectLayer, saveImageBlob],
  )

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) void addPhotoFromFile(file)
    },
    [addPhotoFromFile],
  )

  /**
   * Stage の背景（Layer または Stage 本体）をクリック/タップした時は選択解除。
   * ノードや Transformer ハンドル上では維持（getClassName で判定）。
   */
  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void => {
      const target = e.target
      const onEmpty =
        target === target.getStage() || target.getClassName() === 'Layer'
      if (onEmpty) selectLayer(null)
    },
    [selectLayer],
  )

  // 表示サイズ。scale 未確定（初回）時は 0 にならないよう最低 1px。
  const stageW = Math.max(1, dimensions.width * scale)
  const stageH = Math.max(1, dimensions.height * scale)
  // Stage を表示縮小しているので、Transformer のハンドル/枠線を画面上で適正サイズに
  // 保つため scale の逆数で補正する（小画面・iPad でハンドルが小さくなりすぎない）。
  const invScale = scale > 0 ? 1 / scale : 1

  const visibleLayers = layers.filter((l) => l.visible)

  return (
    <div className="canvas-stage-wrap">
      <div
        ref={containerRef}
        className={`canvas-stage canvas-stage--${aspect}${
          dragging ? ' is-dragging' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => {
          // 空状態（レイヤー0件）時はキャンバスクリックでファイル選択を開く。
          // レイヤーがある時は Konva 側で選択インタラクションを処理するため、ここでは何もしない。
          if (visibleLayers.length === 0) fileInputRef.current?.click()
        }}
        role={visibleLayers.length === 0 ? 'button' : undefined}
        tabIndex={visibleLayers.length === 0 ? 0 : undefined}
        aria-label="写真をアップロードしてベースレイヤーを追加"
      >
        <div className="canvas-stage__inner" style={{ width: stageW, height: stageH }}>
          {scale > 0 ? (
            <Stage
              width={stageW}
              height={stageH}
              scaleX={scale}
              scaleY={scale}
              onMouseDown={handleStageMouseDown}
              onTouchStart={handleStageMouseDown}
            >
              <KonvaLayer>
                {visibleLayers.map((layer) => (
                  <LayerNode
                    key={layer.id}
                    layer={layer}
                    selected={layer.id === selectedLayerId}
                    onNodeRef={(node) => {
                      if (node) nodeRegistry.current.set(layer.id, node)
                      else nodeRegistry.current.delete(layer.id)
                    }}
                  />
                ))}
                <KonvaTransformer
                  ref={transformerRef}
                  rotateEnabled
                  keepRatio={false}
                  flipEnabled={false}
                  borderStroke="#7c3aed"
                  anchorStroke="#7c3aed"
                  anchorFill="#ffffff"
                  anchorSize={12 * invScale}
                  anchorCornerRadius={3 * invScale}
                  borderStrokeWidth={1.5 * invScale}
                  rotateAnchorOffset={28 * invScale}
                  onTransformEnd={() => {
                    // e.target はバインディング次第で Transformer/ノードが揺れるため、
                    // Transformer にアタッチ中のノードを直接取得して確実に読む。
                    const node = transformerRef.current?.nodes()[0]
                    const id = selectedLayerId
                    if (!node || !id) return
                    // リサイズ（scaleX/scaleY）を寸法に焼き込み、scale を 1 に戻す。
                    const baked = bakeScale(
                      node.width(),
                      node.height(),
                      node.scaleX(),
                      node.scaleY(),
                    )
                    void updateTransform(id, {
                      x: node.x(),
                      y: node.y(),
                      width: baked.width,
                      height: baked.height,
                      rotation: node.rotation(),
                    })
                    node.scaleX(1)
                    node.scaleY(1)
                  }}
                />
              </KonvaLayer>
            </Stage>
          ) : (
            <div className="canvas-stage__loading" aria-hidden="true" />
          )}
        </div>

        <span className="canvas-stage__aspect">{ASPECT_LABELS[aspect]}</span>

        {visibleLayers.length === 0 && (
          <div className="canvas-stage__empty">
            <p className="canvas-stage__empty-title">写真をドロップ または クリック</p>
            <p className="canvas-stage__empty-hint">
              アップロードした写真がベースレイヤーになります（cover フィット）
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="canvas-stage__file-input"
          aria-label="写真をアップロード"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void addPhotoFromFile(file)
            e.target.value = '' // 同一ファイルの再選択を許可
          }}
        />
      </div>

      <div className="canvas-stage__toolbar">
        <span className="canvas-stage__hint">
          {dimensions.width}×{dimensions.height}px · {layers.length} レイヤー
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => fileInputRef.current?.click()}
        >
          ＋ 写真
        </button>
      </div>
    </div>
  )
}
