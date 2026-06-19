/**
 * Kasane Studio — 決定論的プロンプト組み立て（中核設計の核③「構造化プロンプトで再現性」）。
 *
 * Gemini（nano banana / `gemini-2.5-flash-image`）は「パーツの見た目生成」に専念する。
 * ユーザーは自由文でなくフィールド入力（StyleSpec ＋ PartSpec）を行い、本関数がそれを
 * 決定論的に1本のプロンプト文字列へ組み立てる。同じ入力からは常に同じ文字列が生成される
 * （プロンプトガチャを消す）。これが E4「スタイル統一」の中核。
 *
 * 配置 / 移動 / 拡縮 / 回転 / 透過 はローカルのレイヤーキャンバスで行う（生成と配置の分離）。
 * したがってここでは生成する「1つのパーツ」だけを指示し、Gemini が背景・写真・レイアウトまで
 * 描いてしまうのを防ぐための制約（孤立した1要素・無地/透過背景・写真なし）を常に含める。
 *
 * refLayerIds（参照画像）はプロンプト文字列ではなく API リクエストの添付画像として扱う（S4.4）。
 * 本関数は refLayerIds をプロンプトに含めない（画像メタはテキストプロンプトのスコープ外）。
 */
import { type StyleSpec } from '../types'
import { getMoodPreset } from '../style/presets'

/**
 * 生成対象のパーツ指定。StyleSpec（雰囲気）と組でプロンプトへ組み立てられる。
 * S5.1（AddPartPanel）の「内容・役割」入力に対応する。
 */
export interface PartSpec {
  /** 描く内容（「コーヒーカップ」「割引バッジ」等）。空文字は不可。 */
  content: string
  /** パーツの役割/配置上の意図（「メインビジュアル」「アクセサリー」等）。空も可。 */
  role: string
}

/** 言語コード → プロンプト内のテキスト言語表示。未知コードはそのまま言語名として出す。 */
const LANGUAGE_LABEL: Record<string, string> = {
  ja: '日本語',
  en: '英語',
}

/**
 * StyleSpec ＋ PartSpec から、Gemini へ投げる1本のプロンプト文字列を決定論的に組み立てる。
 *
 * 決定論性の担保: フィールドを固定順で並べ、空値はスキップし、配列は入力順を保ったまま
 * 結合する。Date / Math.random 等の非決定的な要素は一切使わない。
 * → 同じ引数からは常に同じ戻り値（acceptance「同じ入力から同じプロンプト」）。
 */
export function assembleStylePrompt(style: StyleSpec, part: PartSpec): string {
  const lines: string[] = []

  // --- 役割・対象（パーツの指示） ---
  lines.push('広告画像を構成する「1つのパーツ」を生成してください。')
  const role = part.role.trim()
  if (role) {
    lines.push(`役割: ${role}`)
  }
  lines.push(`内容: ${part.content.trim()}`)

  // --- 制約（生成と配置の分離のための必須項目） ---
  lines.push('制約:')
  lines.push('- 孤立した1つの要素として描く（写真全体・シーン・他のパーツは描かない）')
  lines.push('- 背景は無地または透明にする（写真背景は含めない）')
  lines.push('- 余計なテキスト・枠・ドキュメント風の装飾は入れない')

  // --- 雰囲気（StyleSpec のうち設定されている項目のみ） ---
  const vibeLines: string[] = []
  const moodLabel = getMoodPreset(style.moodPreset)?.label
  if (moodLabel) {
    vibeLines.push(`テイスト: ${moodLabel}`)
  }
  if (style.brief.trim()) {
    vibeLines.push(`雰囲気: ${style.brief.trim()}`)
  }
  if (style.palette.length > 0) {
    vibeLines.push(`カラー: ${style.palette.join(' / ')}`)
  }
  if (style.typographyFeel.trim()) {
    vibeLines.push(`タイポグラフィ: ${style.typographyFeel.trim()}`)
  }
  if (style.decoration.trim()) {
    vibeLines.push(`装飾: ${style.decoration.trim()}`)
  }
  if (vibeLines.length > 0) {
    lines.push('雰囲気:')
    for (const line of vibeLines) {
      lines.push(`- ${line}`)
    }
  }

  // --- テキスト言語（パーツ内にテキストを含む場合の指定） ---
  const langLabel = LANGUAGE_LABEL[style.language] ?? style.language
  lines.push(`テキストを含む場合は ${langLabel} で`)

  return lines.join('\n')
}
