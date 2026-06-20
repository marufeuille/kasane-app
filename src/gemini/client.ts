/**
 * Kasane Studio — Gemini（nano banana / `gemini-2.5-flash-image`）クライアント。
 *
 * `:generateContent` の薄ラッパ。プロンプト＋任意の参照画像を送り、応答の
 * inlineData(base64 PNG) を Blob で返す。配置 / 移動 / 拡縮 / 回転 / 透過 は
 * ローカルのレイヤーキャンバスで行うため、ここでは「1つのパーツ画像」の
 * 生成だけを担う（中核設計：生成と配置の分離）。
 *
 * aspectRatio は `generationConfig.responseFormat.image.aspectRatio` で指定する
 * （`gemini-2.5-flash-image` は固定 1024px 出力のため、解像度指定は持たない）。
 * CORS 回避のプロキシは proxyUrl でルートを差し替え可能（S2.2 / dt-kd9.2 で整備）。
 *
 * API キー（BYOK）・モデル・プロキシ URL は呼び出し側が設定（IndexedDB）から
 * 取得して渡す。本モジュールは純粋な HTTP ラッパ（DB 非依存）とし、fetch は
 * グローバルを使う（テストでは vi.stubGlobal で差し替え）。
 */
import { DEFAULT_MODEL, MAX_REF_LAYERS, type AspectRatio } from '../types'

/** プロキシ未設定時の直接アクセス先（v1beta を含むルート）。 */
const DIRECT_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * 参照画像（base64）。既存パーツを `StyleSpec.refLayerIds` から組み立てて
 * 渡す（S4.4 / dt-tud.4）。雰囲気を揃えるため生成リクエストに同梱される。
 */
export interface ReferenceImage {
  /** MIME タイプ（"image/png" / "image/jpeg" 等）。 */
  mimeType: string
  /** base64 エンコード済み画像データ（Data URL の `data:…;base64,` プレフィックスは含めない）。 */
  data: string
}

/** `generateImagePart` の入力。 */
export interface GenerateImageInput {
  /** BYOK の Gemini API キー。空はエラー。 */
  apiKey: string
  /** 生成指示プロンプト（`assembleStylePrompt` で組み立てた1本）。空はエラー。 */
  prompt: string
  /** 出力アスペクト比（`responseFormat.image.aspectRatio` へ反映）。 */
  aspectRatio: AspectRatio
  /** 参照画像（最大 `MAX_REF_LAYERS` まで同梱、超過分は前面から切り捨て）。 */
  referenceImages?: ReferenceImage[]
  /** モデル名（省略時 `DEFAULT_MODEL` = `gemini-2.5-flash-image`）。 */
  model?: string
  /** CORS 回避用プロキシのルート URL（省略時は直接アクセス）。末尾スラッシュは許容。 */
  proxyUrl?: string
}

/**
 * Gemini API 起因のエラー。ユーザー向けメッセージ（`.message`）を保持し、
 * HTTP ステータス（`.status`）も参照可能。UI は `.message` をそのまま表示する想定。
 */
export class GeminiError extends Error {
  /** HTTP ステータス（ネットワークエラーや事前検証エラーは `undefined`）。 */
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
  }
}

/**
 * Blob（既存パーツ画像）を base64 文字列へ変換する。参照画像
 * （`referenceImages`）を組み立てる際に呼び出し側で使うヘルパ。
 * 大きな画像でもスタック枯渇しないようチャンクごとに変換する。
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * 1枚のパーツ画像を生成し Blob（PNG 等）で返す。
 *
 * @throws {GeminiError} APIキー未設定・プロンプト空・HTTPエラー・画像未返却・
 *         ネットワーク/CORS エラー等。`.message` はユーザー向け日本語メッセージ。
 */
export async function generateImagePart(input: GenerateImageInput): Promise<Blob> {
  const apiKey = input.apiKey?.trim()
  if (!apiKey) {
    throw new GeminiError(
      'Gemini APIキーが設定されていません。設定画面でBYOKキーを入力してください。',
    )
  }

  const prompt = input.prompt?.trim()
  if (!prompt) {
    throw new GeminiError('プロンプトが空です。生成内容を入力してください。')
  }

  const model = input.model?.trim() || DEFAULT_MODEL
  const refs = (input.referenceImages ?? []).slice(0, MAX_REF_LAYERS)

  // API ルート構築（proxyUrl があればそれをルートに、なければ公式直接）。
  const root = (input.proxyUrl?.trim() || DIRECT_API_ROOT).replace(/\/+$/, '')
  const url = `${root}/models/${encodeURIComponent(model)}:generateContent`

  // リクエストボディ: contents[0].parts に text + 参照画像(inline_data) を並べる。
  // 2.5-flash-image は固定1024px（imageSize 指定不可）。aspectRatio のみ指定。
  const parts: object[] = [{ text: prompt }]
  for (const ref of refs) {
    parts.push({ inline_data: { mime_type: ref.mimeType, data: ref.data } })
  }
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      responseFormat: { image: { aspectRatio: input.aspectRatio } },
    },
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    // ネットワークエラー / CORS 拒否 / プロキシ未到達。
    throw new GeminiError(
      'Gemini APIに接続できませんでした。ネットワーク状況、またはCORS回避用プロキシ設定を確認してください。',
    )
  }

  if (!res.ok) {
    throw new GeminiError(await formatHttpError(res), res.status)
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new GeminiError('Gemini APIの応答を解析できませんでした。再度お試しください。')
  }

  const image = extractFirstImage(json)
  if (!image) {
    throw new GeminiError(
      '画像を生成できませんでした。プロンプトや参照画像を見直して再度お試しください。',
    )
  }

  return new Blob([decodeBase64ToArrayBuffer(image.data)], { type: image.mimeType })
}

/**
 * HTTP エラーレスポンスをユーザー向けメッセージへ整形。
 * API のエラーボディ（`{ error: { message } }`）があれば末尾に添える。
 */
async function formatHttpError(res: Response): Promise<string> {
  let detail = ''
  try {
    const data = (await res.json()) as { error?: { message?: string } }
    detail = data?.error?.message ?? ''
  } catch {
    // JSON でなければ詳細なし
  }
  const tail = detail ? `（${detail}）` : ''

  switch (res.status) {
    case 400:
      return `リクエスト内容が不正です。入力を見直してください。${tail}`
    case 401:
    case 403:
      return `APIキーが無効、または権限がありません。設定画面のBYOKキーを確認してください。${tail}`
    case 404:
      return `指定のモデルが見つかりません。設定画面のモデル名を確認してください。${tail}`
    case 429:
      return `APIの利用制限（レートリミット）に達しました。しばらく待ってから再試行してください。${tail}`
    default:
      if (res.status >= 500) {
        return `Gemini API側でエラーが発生しました（HTTP ${res.status}）。時間をおいて再試行してください。${tail}`
      }
      return `画像生成に失敗しました（HTTP ${res.status}）。${tail}`
  }
}

/** Gemini の parts 配列（snake_case / camelCase 両対応）から最初の画像を取り出す。 */
function extractFirstImage(
  json: unknown,
): { data: string; mimeType: string } | null {
  const candidates = (json as {
    candidates?: Array<{ content?: { parts?: unknown[] } }>
  })?.candidates
  const parts = candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return null

  for (const part of parts) {
    const p = part as {
      inline_data?: { data?: string; mime_type?: string }
      inlineData?: { data?: string; mimeType?: string }
    }
    // snake_case / camelCase のどちらかを取り、単一型へ正規化して読む。
    const inline = (p.inline_data ?? p.inlineData) as
      | { data?: string; mime_type?: string; mimeType?: string }
      | undefined
    if (inline?.data) {
      return {
        data: inline.data,
        mimeType: inline.mime_type ?? inline.mimeType ?? 'image/png',
      }
    }
  }
  return null
}

/** base64 文字列をデコードして ArrayBuffer を返す（Blob 構築用）。 */
function decodeBase64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return buffer
}
