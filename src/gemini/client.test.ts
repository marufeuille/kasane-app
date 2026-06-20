import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  blobToBase64,
  generateImagePart,
  GeminiError,
  type GenerateImageInput,
} from './client'

/**
 * S2.1（dt-kd9.1）gemini/client のテスト。
 *
 * 本ストーリーは client ロジック層のみで UI を持たないため、fetch をモックして
 * 「生成（base64→Blob）／aspectRatio 反映／参照画像同梱（最大10枚）／エラー整形」を検証する。
 * 実アプリ画面での実機確認は dt-b9l.1（AddPartPanel）で復活する。
 */

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** 成功レスポンス（最初の画像 part を1つ返す）を構築するヘルパ。 */
function okResponse(data = 'AAEC', mimeType = 'image/png'): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        { content: { parts: [{ inline_data: { mime_type: mimeType, data } }] } },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

/** HTTP エラーレスポンスを構築するヘルパ。 */
function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** 直近の fetch 呼び出しの [url, init] を取り出す。 */
function lastCall(): [string, RequestInit] {
  const call = fetchMock.mock.calls.at(-1)!
  return [call[0] as string, call[1] as RequestInit]
}

const baseInput: GenerateImageInput = {
  apiKey: 'test-key',
  prompt: 'コーヒーカップを描いて',
  aspectRatio: '1:1',
}

describe('生成（テキスト → 画像1枚 → Blob）', () => {
  it('画像1枚を生成し Blob で取得できる', async () => {
    fetchMock.mockResolvedValueOnce(okResponse('iVBORw0KGgo=', 'image/png'))

    const blob = await generateImagePart(baseInput)

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
    // base64 をデコードしたバイト列が保持されていること
    const buf = new Uint8Array(await blob.arrayBuffer())
    expect(buf.length).toBeGreaterThan(0)
  })

  it('正しいエンドポイント・ヘッダ・モデルで fetch を呼ぶ', async () => {
    fetchMock.mockResolvedValueOnce(okResponse())

    await generateImagePart(baseInput)

    const [url, init] = lastCall()
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
    )
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['x-goog-api-key']).toBe('test-key')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('モデル名・proxyUrl を差し替えられる', async () => {
    fetchMock.mockResolvedValueOnce(okResponse())

    await generateImagePart({
      ...baseInput,
      model: 'gemini-3-pro-image',
      proxyUrl: 'https://my-worker.dev/v1beta/',
    })

    const [url] = lastCall()
    expect(url).toBe('https://my-worker.dev/v1beta/models/gemini-3-pro-image:generateContent')
  })
})

describe('aspectRatio の反映', () => {
  it('responseFormat.image.aspectRatio に入力の比率が入る', async () => {
    fetchMock.mockResolvedValueOnce(okResponse())

    await generateImagePart({ ...baseInput, aspectRatio: '9:16' })

    const body = JSON.parse(lastCall()[1].body as string)
    expect(body.generationConfig.responseFormat.image.aspectRatio).toBe('9:16')
  })

  it('比率を変えるとリクエストボディも変わる', async () => {
    // 呼び出しごとに新しい Response を返す（同一インスタンス再利用は body 二重読みになる）
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()))

    await generateImagePart({ ...baseInput, aspectRatio: '16:9' })
    const a = JSON.parse(lastCall()[1].body as string).generationConfig.responseFormat.image
      .aspectRatio
    await generateImagePart({ ...baseInput, aspectRatio: '4:5' })
    const b = JSON.parse(lastCall()[1].body as string).generationConfig.responseFormat.image
      .aspectRatio

    expect(a).toBe('16:9')
    expect(b).toBe('4:5')
  })
})

describe('参照画像の同梱（最大10枚）', () => {
  it('参照画像が inline_data として text の後に並ぶ', async () => {
    fetchMock.mockResolvedValueOnce(okResponse())

    await generateImagePart({
      ...baseInput,
      referenceImages: [
        { mimeType: 'image/png', data: 'AAAA' },
        { mimeType: 'image/jpeg', data: 'BBBB' },
      ],
    })

    const parts = JSON.parse(lastCall()[1].body as string).contents[0].parts
    expect(parts[0]).toEqual({ text: baseInput.prompt })
    expect(parts[1]).toEqual({ inline_data: { mime_type: 'image/png', data: 'AAAA' } })
    expect(parts[2]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: 'BBBB' } })
  })

  it('参照なしでは inline_data を含めない（text のみ）', async () => {
    fetchMock.mockResolvedValueOnce(okResponse())

    await generateImagePart(baseInput)

    const parts = JSON.parse(lastCall()[1].body as string).contents[0].parts
    expect(parts).toEqual([{ text: baseInput.prompt }])
  })

  it('11枚以上渡すと10枚に切り捨てられる（MAX_REF_LAYERS）', async () => {
    fetchMock.mockResolvedValueOnce(okResponse())
    const refs = Array.from({ length: 12 }, (_, i) => ({
      mimeType: 'image/png',
      data: `d${i}`,
    }))

    await generateImagePart({ ...baseInput, referenceImages: refs })

    const parts = JSON.parse(lastCall()[1].body as string).contents[0].parts
    const inlineParts = parts.filter(
      (p: { inline_data?: unknown }) => p.inline_data !== undefined,
    )
    expect(inlineParts).toHaveLength(10)
    // 前面10枚が採用され、末尾2枚は落ちる
    expect(inlineParts[0].inline_data.data).toBe('d0')
    expect(inlineParts[9].inline_data.data).toBe('d9')
  })
})

describe('エラー整形（ユーザー向けメッセージ）', () => {
  it('APIキー未設定で GeminiError（fetch 呼ばない）', async () => {
    await expect(generateImagePart({ ...baseInput, apiKey: '' })).rejects.toThrow(
      GeminiError,
    )
    await expect(
      generateImagePart({ ...baseInput, apiKey: '   ' }),
    ).rejects.toThrow(/APIキーが設定されていません/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('プロンプト空で GeminiError', async () => {
    await expect(
      generateImagePart({ ...baseInput, prompt: '   ' }),
    ).rejects.toThrow(/プロンプトが空/)
  })

  it('401 で認証エラーメッセージ（status も保持）', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401, 'API key not valid'))
    const err = await generateImagePart(baseInput).catch((e) => e)
    expect(err).toBeInstanceOf(GeminiError)
    expect((err as Error).message).toMatch(/APIキーが無効/)
    expect((err as GeminiError).status).toBe(401)
  })

  it('429 でレートリミットメッセージ', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(429, 'quota exceeded'))
    await expect(generateImagePart(baseInput)).rejects.toThrow(/利用制限/)
  })

  it('500 系でサーバエラーメッセージ', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(503, 'unavailable'))
    await expect(generateImagePart(baseInput)).rejects.toThrow(/Gemini API側でエラー/)
  })

  it('ネットワーク/CORS エラーで接続メッセージ', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(generateImagePart(baseInput)).rejects.toThrow(/接続できませんでした/)
  })

  it('画像を含まない応答で生成不可メッセージ', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'テキスト説明のみ' }] } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    await expect(generateImagePart(baseInput)).rejects.toThrow(/画像を生成できませんでした/)
  })

  it('camelCase の inlineData にも対応する（SDK 互換）', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'Qk0=' } }] } },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const blob = await generateImagePart(baseInput)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('blobToBase64', () => {
  it('Blob を base64 文字列へ変換する（ラウンドトリップ）', async () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 128])
    const b64 = await blobToBase64(new Blob([bytes]))
    expect(b64).toBe(btoa(String.fromCharCode(0, 1, 2, 255, 128)))
  })
})
