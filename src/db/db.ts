/**
 * Kasane Studio — Dexie（IndexedDB）永続化レイヤ。
 *
 * テーブル（acceptance / plan 確定方針）:
 * - projects: 広告プロジェクト（1 広告 = 1 行）
 * - layers:   レイヤー（projectId でプロジェクトに紐付く、正規化）
 * - blobs:    画像 Blob（写真背景・生成パーツの本体。IndexedDB は Blob を直接保存可能）
 * - settings: key-value（BYOK の Gemini API キー等）
 *
 * BYOK の Gemini API キーも IndexedDB にローカル保存（平文）する方針（plan 確定事項）。
 * 平文保存になる点は UI（S1.3 / dt-4n4.3）で警告する。
 */
import Dexie, { type Table } from 'dexie'
import {
  API_KEY_SETTING_KEY,
  MODEL_SETTING_KEY,
  PROXY_URL_SETTING_KEY,
  type ImageBlob,
  type Layer,
  type Project,
  type Setting,
} from '../types'

class KasaneDB extends Dexie {
  projects!: Table<Project, string>
  layers!: Table<Layer, string>
  blobs!: Table<ImageBlob, string>
  settings!: Table<Setting, string>

  constructor() {
    super('kasane-studio')
    // インデックス設計:
    // - projects: id 主キー / updatedAt で直近編集ソート
    // - layers:   id 主キー / projectId で一括取得 / kind で種別フィルタ
    // - blobs:    id 主キー
    // - settings: key 主キー（key-value）
    this.version(1).stores({
      projects: 'id, updatedAt',
      layers: 'id, projectId, kind',
      blobs: 'id',
      settings: 'key',
    })
  }
}

/** アプリ全体で共有する Dexie インスタンス。 */
export const db = new KasaneDB()

/* ------------------------------------------------------------------ *
 * Projects
 * ------------------------------------------------------------------ */

/** プロジェクトを保存（upsert）。updatedAt は呼び出し側で進めること。 */
export async function putProject(project: Project): Promise<void> {
  await db.projects.put(project)
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id)
}

/** updatedAt 降順（直近編集が先頭）で全プロジェクトを取得。リロード復元の選択に使う。 */
export async function listProjects(): Promise<Project[]> {
  const all = await db.projects.toArray()
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** プロジェクトと、それに紐づくレイヤーを併せて削除。 */
export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.layers, async () => {
    await db.layers.where('projectId').equals(id).delete()
    await db.projects.delete(id)
  })
}

/* ------------------------------------------------------------------ *
 * Layers
 * ------------------------------------------------------------------ */

/** レイヤーを保存（upsert）。 */
export async function putLayer(layer: Layer): Promise<void> {
  await db.layers.put(layer)
}

/** 複数レイヤーを一括保存（順序再採番などに使う）。 */
export async function putLayers(layers: Layer[]): Promise<void> {
  await db.layers.bulkPut(layers)
}

/** プロジェクト配下のレイヤーを order 昇順（背面→前面）で取得。 */
export async function getLayersByProject(projectId: string): Promise<Layer[]> {
  const rows = await db.layers.where('projectId').equals(projectId).toArray()
  return rows.sort((a, b) => a.order - b.order)
}

export async function deleteLayer(id: string): Promise<void> {
  await db.layers.delete(id)
}

/** プロジェクト配下のレイヤーを全削除。 */
export async function deleteLayersByProject(projectId: string): Promise<void> {
  await db.layers.where('projectId').equals(projectId).delete()
}

/* ------------------------------------------------------------------ *
 * Blobs
 * ------------------------------------------------------------------ */

/** 画像 Blob を保存（写真背景・生成パーツ）。 */
export async function putImageBlob(image: ImageBlob): Promise<void> {
  await db.blobs.put(image)
}

export async function getImageBlob(id: string): Promise<ImageBlob | undefined> {
  return db.blobs.get(id)
}

export async function deleteImageBlob(id: string): Promise<void> {
  await db.blobs.delete(id)
}

/* ------------------------------------------------------------------ *
 * Settings (BYOK の Gemini API キー等)
 * ------------------------------------------------------------------ */

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key)
  return row?.value as T | undefined
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value })
}

export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key)
}

/** BYOK の Gemini API キーを取得（未設定なら undefined）。 */
export async function getApiKey(): Promise<string | undefined> {
  return getSetting<string>(API_KEY_SETTING_KEY)
}

/** BYOK の Gemini API キーを平文で保存。空文字列は削除扱い。 */
export async function setApiKey(key: string): Promise<void> {
  if (key === '') {
    await deleteSetting(API_KEY_SETTING_KEY)
    return
  }
  await setSetting(API_KEY_SETTING_KEY, key)
}

/** BYOK の Gemini API キーを削除。 */
export async function clearApiKey(): Promise<void> {
  await deleteSetting(API_KEY_SETTING_KEY)
}

/** Gemini モデル名を取得（未設定=undefined。呼び出し側でデフォルトを適用）。 */
export async function getModel(): Promise<string | undefined> {
  return getSetting<string>(MODEL_SETTING_KEY)
}

/** Gemini モデル名を保存。空文字は未設定扱い（削除）。 */
export async function setModel(value: string): Promise<void> {
  if (value === '') {
    await deleteSetting(MODEL_SETTING_KEY)
    return
  }
  await setSetting(MODEL_SETTING_KEY, value)
}

/** プロキシ URL（CORS 回避用）を取得（未設定=undefined=直接アクセス）。 */
export async function getProxyUrl(): Promise<string | undefined> {
  return getSetting<string>(PROXY_URL_SETTING_KEY)
}

/** プロキシ URL を保存。空文字は未設定扱い（削除=直接アクセス）。 */
export async function setProxyUrl(value: string): Promise<void> {
  if (value === '') {
    await deleteSetting(PROXY_URL_SETTING_KEY)
    return
  }
  await setSetting(PROXY_URL_SETTING_KEY, value)
}
