import { beforeEach, describe, expect, it } from 'vitest'
import { db, getApiKey } from '../db/db'
import { genId, useKasane } from './store'
import { API_KEY_SETTING_KEY, type Layer, type Project } from '../types'

/** DB の全テーブルをクリア（スキーマ維持）。 */
async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()))
}

/** Zustand のメモリ状態を初期値へ戻す。 */
function resetStore(): void {
  useKasane.setState({
    project: null,
    layers: [],
    selectedLayerId: null,
    status: 'idle',
    error: null,
    apiKey: null,
  })
}

beforeEach(async () => {
  await clearAll()
  resetStore()
})

/** 写真レイヤーを雑に作るヘルパー（一部フィールドを上書き可）。 */
function photoLayer(projectId: string, over: Partial<Layer> = {}): Layer {
  return {
    id: genId(),
    projectId,
    kind: 'photo',
    name: 'photo',
    visible: true,
    order: 0,
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    blobId: 'b1',
    ...over,
  } as Layer
}

describe('createProject', () => {
  it('プロジェクトを作成し、メモリと DB の両方に反映する', async () => {
    const p = await useKasane.getState().createProject({
      name: 'ad1',
      aspectRatio: '9:16',
    })
    expect(p.name).toBe('ad1')
    expect(useKasane.getState().project?.id).toBe(p.id)
    expect(useKasane.getState().status).toBe('ready')
    const fromDb = await db.projects.get(p.id)
    expect(fromDb?.aspectRatio).toBe('9:16')
  })
})

describe('layers — Zustand 経由で 追加 / 選択 / transform 更新', () => {
  it('addLayer でレイヤーを追加でき、selectLayer で選択できる', async () => {
    const p = await useKasane.getState().createProject()
    const layer = photoLayer(p.id)
    await useKasane.getState().addLayer(layer)

    expect(useKasane.getState().layers).toHaveLength(1)
    expect(useKasane.getState().layers[0].projectId).toBe(p.id)
    // DB にも入っている
    expect(await db.layers.get(layer.id)).toBeDefined()

    useKasane.getState().selectLayer(layer.id)
    expect(useKasane.getState().selectedLayerId).toBe(layer.id)
    expect(useKasane.getState().selectedLayer()?.id).toBe(layer.id)
  })

  it('updateTransform で変形を部分更新し DB に反映する（他フィールドは維持）', async () => {
    const p = await useKasane.getState().createProject()
    const layer = photoLayer(p.id)
    await useKasane.getState().addLayer(layer)

    await useKasane.getState().updateTransform(layer.id, { x: 50, opacity: 0.5 })

    const l = useKasane.getState().layers[0]
    expect(l.transform.x).toBe(50)
    expect(l.transform.opacity).toBe(0.5)
    expect(l.transform.width).toBe(100) // 維持

    const fromDb = await db.layers.get(layer.id)
    expect(fromDb?.transform.x).toBe(50)
  })

  it('removeLayer で削除し order を詰める', async () => {
    const p = await useKasane.getState().createProject()
    await useKasane.getState().addLayer(photoLayer(p.id, { id: 'l1' }))
    await useKasane.getState().addLayer(photoLayer(p.id, { id: 'l2' }))
    await useKasane.getState().addLayer(photoLayer(p.id, { id: 'l3' }))

    await useKasane.getState().removeLayer('l2')

    const ids = useKasane.getState().layers.map((l) => l.id)
    expect(ids).toEqual(['l1', 'l3'])
    expect(useKasane.getState().layers.map((l) => l.order)).toEqual([0, 1])
    expect(await db.layers.get('l2')).toBeUndefined()
  })

  it('reorderLayer で z 順序を移動できる', async () => {
    const p = await useKasane.getState().createProject()
    await useKasane.getState().addLayer(photoLayer(p.id, { id: 'a' }))
    await useKasane.getState().addLayer(photoLayer(p.id, { id: 'b' }))
    await useKasane.getState().addLayer(photoLayer(p.id, { id: 'c' }))

    // a（先頭=最背面）を末尾=最前面へ
    await useKasane.getState().reorderLayer('a', 2)

    expect(useKasane.getState().layers.map((l) => l.id)).toEqual(['b', 'c', 'a'])
  })

  it('updateLayer で可変フィールド（name/visible 等）を更新できる', async () => {
    const p = await useKasane.getState().createProject()
    await useKasane.getState().addLayer(photoLayer(p.id, { id: 'l1' }))
    await useKasane.getState().updateLayer('l1', { name: '背景', visible: false })
    const l = useKasane.getState().layers[0]
    expect(l.name).toBe('背景')
    expect(l.visible).toBe(false)
  })
})

describe('hydrate — リロード後の復元', () => {
  it('直近編集プロジェクトと API キーを復元する', async () => {
    const old: Project = {
      id: 'old',
      name: 'old',
      aspectRatio: '1:1',
      resolution: '1K',
      styleSpec: { mood: 'pop' },
      createdAt: 1,
      updatedAt: 1,
    }
    const newer: Project = {
      id: 'new',
      name: 'new',
      aspectRatio: '4:5',
      resolution: '2K',
      styleSpec: { mood: 'luxe' },
      createdAt: 2,
      updatedAt: 5,
    }
    await db.projects.put(old)
    await db.projects.put(newer)
    await db.layers.put({
      id: 'L1',
      projectId: 'new',
      kind: 'text',
      name: 'title',
      visible: true,
      order: 0,
      transform: { x: 1, y: 2, width: 3, height: 4, rotation: 0, opacity: 1 },
      text: 'hello',
      fontFamily: 'sans',
      fontSize: 24,
      fontWeight: 700,
      color: '#000',
    })
    await db.settings.put({ key: API_KEY_SETTING_KEY, value: 'KEY123' })

    await useKasane.getState().hydrate()

    expect(useKasane.getState().status).toBe('ready')
    expect(useKasane.getState().project?.id).toBe('new')
    expect(useKasane.getState().layers.map((l) => l.id)).toEqual(['L1'])
    expect(useKasane.getState().apiKey).toBe('KEY123')
  })

  it('プロジェクトが無ければ ready で null のまま', async () => {
    await useKasane.getState().hydrate()
    expect(useKasane.getState().status).toBe('ready')
    expect(useKasane.getState().project).toBeNull()
  })
})

describe('project updates', () => {
  it('setStyleSpec で部分更新し DB に反映', async () => {
    const p = await useKasane.getState().createProject({ styleSpec: { mood: 'pop' } })
    await useKasane.getState().setStyleSpec({ mood: 'pop2', brief: '明るく' })

    const cur = useKasane.getState().project
    expect(cur?.styleSpec.mood).toBe('pop2')
    expect(cur?.styleSpec.brief).toBe('明るく')

    const fromDb = await db.projects.get(p.id)
    expect(fromDb?.styleSpec.brief).toBe('明るく')
    // updatedAt が進む
    expect(fromDb?.updatedAt).toBeGreaterThan(p.updatedAt)
  })

  it('setAspectRatio で比率を変更し DB に反映', async () => {
    const p = await useKasane.getState().createProject({ aspectRatio: '1:1' })
    await useKasane.getState().setAspectRatio('16:9')
    expect(useKasane.getState().project?.aspectRatio).toBe('16:9')
    const fromDb = await db.projects.get(p.id)
    expect(fromDb?.aspectRatio).toBe('16:9')
  })
})

describe('settings (BYOK) — saveApiKey', () => {
  it('saveApiKey でキーを保存し、store と DB の両方に反映する', async () => {
    await useKasane.getState().saveApiKey('MY-KEY')
    expect(useKasane.getState().apiKey).toBe('MY-KEY')
    expect(await getApiKey()).toBe('MY-KEY')
  })

  it('saveApiKey("") はクリア扱い（store/apiKey=null・DB から削除）', async () => {
    await useKasane.getState().saveApiKey('MY-KEY')
    await useKasane.getState().saveApiKey('')
    expect(useKasane.getState().apiKey).toBeNull()
    expect(await getApiKey()).toBeUndefined()
  })

  it('保存したキーは再読込（refreshApiKey）で復元される = リロード後保持', async () => {
    await useKasane.getState().saveApiKey('PERSIST')
    // メモリ上の apiKey を失わせ、IndexedDB からの再読込をシミュレート
    useKasane.setState({ apiKey: null })
    await useKasane.getState().refreshApiKey()
    expect(useKasane.getState().apiKey).toBe('PERSIST')
  })
})
