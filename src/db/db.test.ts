import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearApiKey,
  db,
  deleteProject,
  getApiKey,
  getLayersByProject,
  getModel,
  getProject,
  getProxyUrl,
  getSetting,
  listProjects,
  putImageBlob,
  putLayer,
  putProject,
  setApiKey,
  setModel,
  setProxyUrl,
  setSetting,
} from './db'
import type { ImageBlob, Layer, Project } from '../types'
import { defaultStyleSpec } from '../style/presets'

/** 全テーブルのデータをクリア（スキーマは維持）。テスト間の独立性を担保。 */
async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()))
}

const NOW = 1_000

function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'demo',
    aspectRatio: '1:1',
    resolution: '1K',
    styleSpec: defaultStyleSpec(),
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }
}

function makeLayer(over: Partial<Layer> = {}): Layer {
  return {
    id: 'l1',
    projectId: 'p1',
    kind: 'photo',
    name: 'photo',
    visible: true,
    order: 0,
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    blobId: 'b1',
    ...over,
  } as Layer
}

beforeEach(clearAll)

describe('projects', () => {
  it('putProject で保存し getProject で読める', async () => {
    await putProject(makeProject())
    const got = await getProject('p1')
    expect(got?.name).toBe('demo')
    expect(got?.aspectRatio).toBe('1:1')
  })

  it('listProjects は updatedAt 降順（直近編集が先頭）', async () => {
    await putProject(makeProject({ id: 'old', updatedAt: 1 }))
    await putProject(makeProject({ id: 'new', updatedAt: 5 }))
    await putProject(makeProject({ id: 'mid', updatedAt: 3 }))
    const list = await listProjects()
    expect(list.map((p) => p.id)).toEqual(['new', 'mid', 'old'])
  })

  it('deleteProject は関連レイヤーも削除し、他プロジェクトは残す', async () => {
    await putProject(makeProject({ id: 'p1' }))
    await putLayer(makeLayer({ id: 'l1', projectId: 'p1' }))
    await putLayer(makeLayer({ id: 'l2', projectId: 'other' }))
    await deleteProject('p1')
    expect(await getProject('p1')).toBeUndefined()
    expect(await getLayersByProject('p1')).toHaveLength(0)
    expect(await db.layers.get('l2')).toBeDefined()
  })
})

describe('layers', () => {
  it('getLayersByProject は order 昇順（背面→前面）', async () => {
    await putLayer(makeLayer({ id: 'b', order: 2 }))
    await putLayer(makeLayer({ id: 'a', order: 0 }))
    await putLayer(makeLayer({ id: 'c', order: 1 }))
    const layers = await getLayersByProject('p1')
    expect(layers.map((l) => l.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('blobs', () => {
  it('画像 Blob を保存して読める（リロード復元相当）', async () => {
    const data = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const image: ImageBlob = {
      id: 'b1',
      blob: data,
      mimeType: 'image/png',
      width: 10,
      height: 10,
      createdAt: NOW,
    }
    await putImageBlob(image)
    const got = await db.blobs.get('b1')
    expect(got).toBeDefined()
    expect(got?.mimeType).toBe('image/png')
    expect(got?.width).toBe(10)
  })
})

describe('settings (BYOK キー等)', () => {
  it('key-value の設定/取得', async () => {
    await setSetting('foo', { n: 1 })
    expect(await getSetting<{ n: number }>('foo')).toEqual({ n: 1 })
  })

  it('API キーの設定/取得/クリア', async () => {
    await setApiKey('secret')
    expect(await getApiKey()).toBe('secret')
    await clearApiKey()
    expect(await getApiKey()).toBeUndefined()
  })

  it('setApiKey の空文字はクリア扱い', async () => {
    await setApiKey('secret')
    await setApiKey('')
    expect(await getApiKey()).toBeUndefined()
  })

  it('モデル名の設定/取得/空文字はクリア扱い', async () => {
    await setModel('gemini-2.5-flash-image')
    expect(await getModel()).toBe('gemini-2.5-flash-image')
    await setModel('')
    expect(await getModel()).toBeUndefined()
  })

  it('プロキシ URL の設定/取得/空文字はクリア扱い', async () => {
    await setProxyUrl('https://worker.example.dev/')
    expect(await getProxyUrl()).toBe('https://worker.example.dev/')
    await setProxyUrl('')
    expect(await getProxyUrl()).toBeUndefined()
  })
})
