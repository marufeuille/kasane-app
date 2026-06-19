/**
 * Kasane Studio — Zustand アプリ状態ストア。
 *
 * 現在編集中の Project / Layers / 選択状態 / StyleSpec をメモリに持ち、
 * 変更は即座に Zustand 経由で反映（配置・微調整は無API・即時）、かつ Dexie に永続化する。
 *
 * acceptance（dt-4n4.2）:
 * - project と画像 Blob を保存し、リロード後も復元される（hydrate / listProjects）
 * - Zustand 経由でレイヤーの追加 / 選択 / transform 更新ができる
 *
 * 設計上の注意:
 * - メモリ上の layers 配列は背面→前面（order 昇順）順。変更時は order を再採番して永続化。
 * - project 本体（aspect / resolution / styleSpec 等）の変更は updatedAt を進めて putProject。
 * - 選択状態（selectedLayerId）は UI ローカルなので DB には保存しない。
 */
import { create } from 'zustand'
import {
  deleteLayer,
  getApiKey,
  getImageBlob,
  getLayersByProject,
  listProjects,
  putImageBlob,
  putLayer,
  putLayers,
  putProject,
  setApiKey,
} from '../db/db'
import { defaultStyleSpec } from '../style/presets'
import type {
  AspectRatio,
  ImageBlob,
  Layer,
  Project,
  Resolution,
  StyleSpec,
  Transform,
} from '../types'

/** IndexedDB からの復元状態。 */
export type HydrationStatus = 'idle' | 'loading' | 'ready' | 'error'

/** 新規プロジェクト作成時の初期値。 */
export interface CreateProjectInput {
  name?: string
  aspectRatio?: AspectRatio
  resolution?: Resolution
  styleSpec?: StyleSpec
}

/** 永続化しないレイヤーフィールド（id/kind/projectId は不変、order は再掃引で決まる）。 */
export type LayerMutablePatch = Partial<
  Omit<Layer, 'id' | 'kind' | 'projectId' | 'order'>
>

export interface KasaneState {
  /** 現在編集中のプロジェクト（未作成なら null）。 */
  project: Project | null
  /** 現在のプロジェクトのレイヤー（背面→前面 = order 昇順）。 */
  layers: Layer[]
  /** 選択中レイヤー ID（未選択 null）。 */
  selectedLayerId: string | null
  /** IndexedDB からの復元状態。 */
  status: HydrationStatus
  /** 復元・操作時の直近エラー（無ければ null）。 */
  error: string | null
  /** BYOK の Gemini API キー（未設定 null）。 */
  apiKey: string | null

  /* ---- lifecycle ---- */

  /** IndexedDB から直近編集プロジェクトを復元する（リロード後の状態回復）。 */
  hydrate: () => Promise<void>
  /** 新規プロジェクトを作成して開く。 */
  createProject: (input?: CreateProjectInput) => Promise<Project>

  /* ---- layers ---- */

  /** レイヤーを追加（末尾=最前面）。order/projectId は自動補完。 */
  addLayer: (layer: Layer) => Promise<void>
  /** 選択レイヤーを切り替え（UI ローカル・非永続化）。 */
  selectLayer: (id: string | null) => void
  /** 選択中レイヤーID を取得するヘルパー。 */
  selectedLayer: () => Layer | null
  /** レイヤーの変形（transform）を部分更新。配置/移動/拡縮/回転/透過。 */
  updateTransform: (id: string, patch: Partial<Transform>) => Promise<void>
  /** レイヤーの可変フィールド（name/visible/text 等）を部分更新。kind は不変。 */
  updateLayer: (id: string, patch: LayerMutablePatch) => Promise<void>
  /** レイヤーを削除。 */
  removeLayer: (id: string) => Promise<void>
  /** レイヤーの z 順序を toIndex に移動し、order を再採番。 */
  reorderLayer: (id: string, toIndex: number) => Promise<void>

  /* ---- project ---- */

  /** StyleSpec を部分更新。 */
  setStyleSpec: (patch: Partial<StyleSpec>) => Promise<void>
  /** アスペクト比を変更。 */
  setAspectRatio: (aspect: AspectRatio) => Promise<void>

  /* ---- blobs ---- */

  /** 画像 Blob を保存（写真背景・生成パーツ）。 */
  saveImageBlob: (image: ImageBlob) => Promise<void>
  /** 画像 Blob を読込。 */
  loadImageBlob: (id: string) => Promise<ImageBlob | undefined>

  /* ---- settings (BYOK) ---- */

  /** API キーを IndexedDB に保存（空文字はクリア扱い）し、store に反映。 */
  saveApiKey: (key: string) => Promise<void>
  /** IndexedDB から API キーを再読込して store に反映。 */
  refreshApiKey: () => Promise<void>
}

/**
 * ID 採番。crypto.randomUUID が使える環境（モダンブラウザ / Node 19+ / テスト）はそれを使い、
 * フォールバックでタイムスタンプ+乱数。
 */
export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** デフォルトの変形（UI が Transformer を操作する前の起点）。 */
export function defaultTransform(): Transform {
  return { x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1 }
}

/**
 * project を updatedAt 更新付きで DB に保存し、更新後の project を返す。
 * createdAt は維持、updatedAt は現在時刻へ。
 *
 * 単調増加を保証するため、現在時刻が前回の updatedAt を超えない（同一ミリ秒内の連続更新）
 * 場合は前回値 +1ms を使う。これにより createProject→setStyleSpec のような同一ティック内の
 * 連続操作でも updatedAt が厳密に進み、更新順序の比較が環境に依存しない。
 */
async function persistProject(project: Project): Promise<Project> {
  const now = Date.now()
  const updatedAt = now > project.updatedAt ? now : project.updatedAt + 1
  const next: Project = { ...project, updatedAt }
  await putProject(next)
  return next
}

export const useKasane = create<KasaneState>((set, get) => {
  /** 現在の project の updatedAt を進めて DB へ反映（project 変更の副作用をまとめる）。 */
  const touchProject = async (): Promise<void> => {
    const cur = get().project
    if (!cur) return
    set({ project: await persistProject(cur) })
  }

  return {
    project: null,
    layers: [],
    selectedLayerId: null,
    status: 'idle',
    error: null,
    apiKey: null,

    /* ---- lifecycle ---- */

    hydrate: async () => {
      set({ status: 'loading', error: null })
      try {
        const [projects, apiKey] = await Promise.all([listProjects(), getApiKey()])
        const latest = projects[0]
        if (!latest) {
          set({ status: 'ready', apiKey: apiKey ?? null })
          return
        }
        const layers = await getLayersByProject(latest.id)
        set({
          project: latest,
          layers,
          selectedLayerId: null,
          status: 'ready',
          apiKey: apiKey ?? null,
        })
      } catch (err) {
        set({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },

    createProject: async (input = {}) => {
      const now = Date.now()
      const project: Project = {
        id: genId(),
        name: input.name ?? 'Untitled',
        aspectRatio: input.aspectRatio ?? '1:1',
        resolution: input.resolution ?? '1K',
        styleSpec: input.styleSpec ?? defaultStyleSpec(),
        createdAt: now,
        updatedAt: now,
      }
      await putProject(project)
      set({
        project,
        layers: [],
        selectedLayerId: null,
        status: 'ready',
      })
      return project
    },

    /* ---- layers ---- */

    addLayer: async (layer) => {
      const { project, layers } = get()
      if (!project) {
        throw new Error('Cannot add a layer without an active project')
      }
      const order = layers.length
      const normalized: Layer = { ...layer, projectId: project.id, order }
      await putLayer(normalized)
      set({ layers: [...layers, normalized] })
      await touchProject()
    },

    selectLayer: (id) => set({ selectedLayerId: id }),

    selectedLayer: () => {
      const { layers, selectedLayerId } = get()
      if (!selectedLayerId) return null
      return layers.find((l) => l.id === selectedLayerId) ?? null
    },

    updateTransform: async (id, patch) => {
      const { layers } = get()
      const idx = layers.findIndex((l) => l.id === id)
      if (idx < 0) return
      const cur = layers[idx]
      const updated: Layer = {
        ...cur,
        transform: { ...cur.transform, ...patch },
      }
      const next = layers.slice()
      next[idx] = updated
      await putLayer(updated)
      set({ layers: next })
      await touchProject()
    },

    updateLayer: async (id, patch) => {
      const { layers } = get()
      const idx = layers.findIndex((l) => l.id === id)
      if (idx < 0) return
      const cur = layers[idx]
      // kind は不変（patch には含まれない型だが、実行時にも上書きしない）
      const updated = { ...cur, ...patch } as Layer
      const next = layers.slice()
      next[idx] = updated
      await putLayer(updated)
      set({ layers: next })
      await touchProject()
    },

    removeLayer: async (id) => {
      const { layers, selectedLayerId } = get()
      const next = layers.filter((l) => l.id !== id)
      // order を詰めて再採番（欠番を残さない）
      const reindexed = next.map((l, i) => ({ ...l, order: i }))
      await deleteLayer(id)
      if (reindexed.length) await putLayers(reindexed)
      set({
        layers: reindexed,
        selectedLayerId: selectedLayerId === id ? null : selectedLayerId,
      })
      await touchProject()
    },

    reorderLayer: async (id, toIndex) => {
      const { layers } = get()
      const from = layers.findIndex((l) => l.id === id)
      if (from < 0) return
      const next = layers.slice()
      const [moved] = next.splice(from, 1)
      const clamped = Math.max(0, Math.min(toIndex, next.length))
      next.splice(clamped, 0, moved)
      const reindexed = next.map((l, i) => ({ ...l, order: i }))
      await putLayers(reindexed)
      set({ layers: reindexed })
      await touchProject()
    },

    /* ---- project ---- */

    setStyleSpec: async (patch) => {
      const cur = get().project
      if (!cur) return
      const project: Project = {
        ...cur,
        styleSpec: { ...cur.styleSpec, ...patch },
      }
      set({ project: await persistProject(project) })
    },

    setAspectRatio: async (aspect) => {
      const cur = get().project
      if (!cur) return
      const project: Project = { ...cur, aspectRatio: aspect }
      set({ project: await persistProject(project) })
    },

    /* ---- blobs ---- */

    saveImageBlob: async (image) => {
      await putImageBlob(image)
    },

    loadImageBlob: async (id) => getImageBlob(id),

    /* ---- settings (BYOK) ---- */

    saveApiKey: async (key) => {
      // 空文字は削除扱い（db.setApiKey に準拠）。store 上は未設定=null。
      await setApiKey(key)
      set({ apiKey: key === '' ? null : key })
    },

    refreshApiKey: async () => {
      const key = await getApiKey()
      set({ apiKey: key ?? null })
    },
  }
})
