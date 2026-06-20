/**
 * Kasane Studio — 共通型定義。
 *
 * 生成（Gemini）と配置・微調整（ローカルレイヤーキャンバス）を分離する
 * データモデルの中核。S1.2（dt-4n4.2）で確立し、後続ストーリー（E2〜E6）がこれを前提とする。
 *
 * 設計の骨子（plan 確定方針）:
 * - Gemini は「パーツ見た目生成」と「写真全体加工」に専念
 * - 配置 / 移動 / 拡縮 / 回転 / 透過(不透明度) はローカルのレイヤーキャンバスで即時・無API
 * - ユーザーは自由文でなくフィールド入力 → アプリが決定論的にプロンプトを組み立てる（再現性）
 */

/** レイヤー種別。photo=背景写真, ai-part=Gemini生成パーツ, text=実フォントテキスト。 */
export type LayerKind = 'photo' | 'ai-part' | 'text'

/**
 * レイヤーのブレンドモード。Konva/Canvas の globalCompositeOperation に対応し、
 * 下位レイヤーとの合成方法を指定する（乗算 / スクリーン / オーバーレイ 等）。
 * 不透明度（transform.opacity）とは直交する合成制御。S3.3 で Inspector から編集。
 * 'destination-in' は下位レイヤーの形で切り抜くクリッピングマスク相当。
 */
export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'
  | 'lighter'
  | 'destination-in'

/** 広告出力サイズのアスペクト比プリセット（plan の技術前提に準拠）。 */
export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9'

/** 出力解像度（Gemini 生成時の 1K / 2K 指定に対応）。 */
export type Resolution = '1K' | '2K'

/**
 * レイヤーの変形。配置 / 移動 / 拡縮 / 回転 / 透過(不透明度) を
 * ローカルのレイヤーキャンバスで即時・無APIに反映するための値。
 * 座標系はキャンバス論理ピクセル。Konva（react-konva）のノードに直接渡す想定。
 */
export interface Transform {
  /** 左上 X（論理 px）。 */
  x: number
  /** 左上 Y（論理 px）。 */
  y: number
  /** 幅（論理 px）。 */
  width: number
  /** 高さ（論理 px）。 */
  height: number
  /** 回転角（度）。 */
  rotation: number
  /** 不透明度 0..1。透過(アルファ)相当。 */
  opacity: number
}

/** 任意のレイヤーが共通で持つフィールド。 */
export interface LayerBase {
  /** レイヤーの一意 ID。 */
  id: string
  /** 所属プロジェクト ID（layers テーブルを projects に正規化して紐付ける）。 */
  projectId: string
  /** レイヤー種別（判別共用体のタグ）。 */
  kind: LayerKind
  /** 表示名（レイヤー一覧用）。 */
  name: string
  /** 表示切替。false で非描画。 */
  visible: boolean
  /** z-order（小さいほど背面）。配列順序の永続化に使う。 */
  order: number
  /** 変形（配置 / 移動 / 拡縮 / 回転 / 透過）。 */
  transform: Transform
  /** ブレンドモード（下位レイヤーとの合成）。S3.3 で Inspector から編集。 */
  blendMode: BlendMode
}

/** 写真レイヤー（背景）。画像本体は blobs テーブルの ImageBlob を参照する。 */
export interface PhotoLayer extends LayerBase {
  kind: 'photo'
  /** 画像 Blob の ID（blobs テーブル）。 */
  blobId: string
}

/** Gemini 生成パーツレイヤー。背景除去済みのパーツ画像を参照。 */
export interface AiPartLayer extends LayerBase {
  kind: 'ai-part'
  /** 画像 Blob の ID（blobs テーブル）。 */
  blobId: string
  /** 生成時に注入したプロンプト/役割（再現性担保用メタ）。 */
  prompt?: string
}

/** 実フォントテキストレイヤー。AI 焼き込みではなく実フォントで描画（テキスト両対応）。 */
export interface TextLayer extends LayerBase {
  kind: 'text'
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
}

/**
 * レイヤー。kind で判別する判別共用体。
 * （acceptance: Layer(kind: photo | ai-part | text)）
 */
export type Layer = PhotoLayer | AiPartLayer | TextLayer

/**
 * スタイル統一（StyleSpec）。雰囲気を一度設定し、全パーツ生成に
 * 決定論的に注入して統一感を出す（プロンプトガチャを消す中核）。
 *
 * 各フィールドは mood プリセット選択で初期値が入り（S4.1 / style/presets.ts）、
 * ユーザーが編集可能。プロンプト組み立て（assembleStylePrompt）は S4.3、
 * 参照画像注入（refLayerIds）は S4.4 で使用する。
 */
export interface StyleSpec {
  /** mood プリセットキー（'pop' | 'luxe' | 'natural' 等）。未選択/カスタムは ''。 */
  moodPreset: string
  /** 雰囲気ブリーフ（自由記述）。プリセットで初期化、ユーザー編集可。 */
  brief: string
  /** カラーパレット（HEX 等）。プリセットで初期化、ユーザー編集可。 */
  palette: string[]
  /** タイポグラフィの質感（「丸ゴシック」「セリフ」等）。 */
  typographyFeel: string
  /** 装飾の質感（「キラキラ」「ミニマル」等）。 */
  decoration: string
  /** テキスト言語（'ja' / 'en' 等）。デフォルト DEFAULT_LANGUAGE。 */
  language: string
  /** 参照画像として同梱するレイヤー ID（最大 MAX_REF_LAYERS。S4.4 で使用）。 */
  refLayerIds: string[]
}

/** プロジェクト。1 広告 = 1 プロジェクト。レイヤーは layers テーブルで正規化。 */
export interface Project {
  id: string
  name: string
  aspectRatio: AspectRatio
  resolution: Resolution
  styleSpec: StyleSpec
  /** 作成時刻（エポック ms）。 */
  createdAt: number
  /** 最終更新時刻（エポック ms）。直近編集プロジェクトの復元ソートに使う。 */
  updatedAt: number
}

/** IndexedDB に保存する画像 Blob（写真背景・生成パーツの本体）。IndexedDB は Blob を直接保存可能。 */
export interface ImageBlob {
  id: string
  blob: Blob
  mimeType: string
  /** 画像の自然幅（px、分かる場合）。 */
  width?: number
  /** 画像の自然高さ（px、分かる場合）。 */
  height?: number
  createdAt: number
}

/** settings テーブルの key-value 行。BYOK の Gemini API キー等もここに格納する。 */
export interface Setting<T = unknown> {
  key: string
  value: T
}

/** settings テーブルで BYOK の Gemini API キーを格納するキー。 */
export const API_KEY_SETTING_KEY = 'gemini.apiKey'

/** settings テーブルで Gemini モデル名を格納するキー（任意設定）。 */
export const MODEL_SETTING_KEY = 'gemini.model'

/** settings テーブルでプロキシ URL（CORS 回避用）を格納するキー（任意設定）。 */
export const PROXY_URL_SETTING_KEY = 'gemini.proxyUrl'

/** Gemini モデル名のデフォルト（nano banana / gemini-2.5-flash-image）。 */
export const DEFAULT_MODEL = 'gemini-2.5-flash-image'

/** StyleSpec.language のデフォルト（日本語ツール）。 */
export const DEFAULT_LANGUAGE = 'ja'

/** LayerBase.blendMode のデフォルト（通常合成 = source-over）。 */
export const DEFAULT_BLEND_MODE: BlendMode = 'source-over'

/** StyleSpec.refLayerIds の上限（plan 技術前提「参照画像は最大10枚」）。S4.4 でバリデーションに使用。 */
export const MAX_REF_LAYERS = 10
