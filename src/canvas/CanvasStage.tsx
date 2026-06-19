/**
 * Kasane Studio — レイヤーキャンバスのルート（react-konva Stage/Layer）。
 *
 * S3.1（dt-5ae.1）で実装する中核:
 * - 広告サイズプリセット（CANVAS_PRESETS）を project.aspectRatio から解決し、
 *   Stage の論理寸法を設定（acceptance: サイズプリセット切替でキャンバス寸法が変わる）。
 * - layers を order 昇順（背面→前面）で描画（acceptance: 複数レイヤーが z 順に正しく描画される）。
 * - 写真をアップロードしてベースレイヤー（PhotoLayer）として表示できる導線（cover フィット）。
 * - iPad のタッチ操作が破綻しないよう、Stage 周辺は touch-action を制御。
 *
 * 配置・移動・拡縮・回転（Transformer）は S3.2 で追加。ここでは表示とベースレイヤー追加に専念。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Layer as KonvaLayer, Stage } from 'react-konva'
import { useKasane, genId } from '../state/store'
import { canvasSizeFor, ASPECT_LABELS } from './presets'
import { coverTransform } from './geometry'
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
  const addLayer = useKasane((s) => s.addLayer)
  const selectLayer = useKasane((s) => s.selectLayer)
  const saveImageBlob = useKasane((s) => s.saveImageBlob)

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // 表示サイズ。scale 未確定（初回）時は 0 にならないよう最低 1px。
  const stageW = Math.max(1, dimensions.width * scale)
  const stageH = Math.max(1, dimensions.height * scale)

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
          // レイヤーがある時は誤操作を避け、追加は下の「＋ 写真」ボタン or DnD のみ。
          // （レイヤー選択インタラクションは S3.2 の Transformer で導入）
          if (visibleLayers.length === 0) fileInputRef.current?.click()
        }}
        role={visibleLayers.length === 0 ? 'button' : undefined}
        tabIndex={visibleLayers.length === 0 ? 0 : undefined}
        aria-label="写真をアップロードしてベースレイヤーを追加"
      >
        <div className="canvas-stage__inner" style={{ width: stageW, height: stageH }}>
          {scale > 0 ? (
            <Stage width={stageW} height={stageH} scaleX={scale} scaleY={scale}>
              <KonvaLayer>
                {visibleLayers.map((layer) => (
                  <LayerNode key={layer.id} layer={layer} />
                ))}
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
