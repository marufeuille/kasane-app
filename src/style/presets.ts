/**
 * Kasane Studio — StyleSpec の mood プリセットと初期値生成。
 *
 * 中核設計（プロンプトガチャを消す）: ユーザーは mood プリセットを選ぶだけで
 * brief / palette / typographyFeel / decoration に決定論的な初期値が入り、
 * 全パーツ生成へ同じ雰囲気が注入される。プリセットは出発点であり、各フィールドは
 * その後ユーザーが自由に編集できる（S4.2 の StylePanel 経由）。
 *
 * acceptance（dt-tud.1）:
 * - mood プリセット選択で各フィールドに初期値が入る（applyMoodPreset）
 * - パレットが保持される（palette: string[]）
 * - StyleSpec 全体は defaultStyleSpec で空/既定値の完全なオブジェクトを生成
 */
import {
  DEFAULT_LANGUAGE,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_WEIGHT,
  type StyleSpec,
} from '../types'

/** mood プリセット1件分。選択時に StyleSpec の各フィールドへ展開される。 */
export interface MoodPreset {
  /** プリセットキー（StyleSpec.moodPreset に保存）。 */
  key: string
  /** 表示名（ポップ / 高級 / ナチュラル 等）。 */
  label: string
  /** 雰囲気ブリーフの初期値。 */
  brief: string
  /** カラーパレットの初期値（HEX）。 */
  palette: string[]
  /** タイポグラフィ質感の初期値。 */
  typographyFeel: string
  /** 装飾質感の初期値。 */
  decoration: string
}

/**
 * mood プリセット一覧。description「ポップ / 高級 / ナチュラル 等」。
 * palette は広告で使いやすい5色程度のセット（背景・メイン・アクセント・テキスト・余白）。
 */
export const MOOD_PRESETS: readonly MoodPreset[] = [
  {
    key: 'pop',
    label: 'ポップ',
    brief: '親しみやすく元気な、明るく若々しい雰囲気',
    palette: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FFFFFF'],
    typographyFeel: '丸ゴシック・太字・遊び心のある組み',
    decoration: 'ポップなイラスト・吹き出し・小物',
  },
  {
    key: 'luxe',
    label: '高級',
    brief: '上質で洗練された、品格と信頼感のある雰囲気',
    palette: ['#1A1A1A', '#C5A572', '#8C7853', '#F5F1E8', '#FFFFFF'],
    typographyFeel: 'セリフ・細字〜中字・トラッキング広め',
    decoration: 'ゴールド箔・上質なテクスチャ・ゆったりとした余白',
  },
  {
    key: 'natural',
    label: 'ナチュラル',
    brief: '素朴で温かみのある、自然志向の落ち着いた雰囲気',
    palette: ['#6B5B4E', '#A3B18A', '#DAD7CD', '#F4A261', '#FEFAE0'],
    typographyFeel: '手書き風・ナチュラルなセリフ・やさしい組み',
    decoration: '植物モチーフ・紙・木目のテクスチャ',
  },
]

/** キーからプリセットを引く。未定義キーは undefined。 */
export function getMoodPreset(key: string): MoodPreset | undefined {
  return MOOD_PRESETS.find((p) => p.key === key)
}

/**
 * mood プリセット選択で StyleSpec の各フィールドに初期値を入れる。
 * 返すのは brief / palette / typographyFeel / decoration と moodPreset キーのみ
 * （language / refLayerIds はユーザー設定なのでプリセットで上書きしない）。
 * palette はプリセット配列のコピー（呼び出し側で自由に編集できる）。
 * 未知キー / 空文字は未選択扱いで空の初期値を返す。
 */
export function applyMoodPreset(key: string): Partial<StyleSpec> {
  const preset = getMoodPreset(key)
  if (!preset) {
    return {
      moodPreset: '',
      brief: '',
      palette: [],
      typographyFeel: '',
      decoration: '',
    }
  }
  return {
    moodPreset: preset.key,
    brief: preset.brief,
    palette: [...preset.palette],
    typographyFeel: preset.typographyFeel,
    decoration: preset.decoration,
  }
}

/**
 * 空の StyleSpec（新規プロジェクト用）。全フィールドに既定値を入れた完全なオブジェクト。
 * 配列は呼び出しごとに新しく作る（参照共有しない = 複数プロジェクトで副作用が起きない）。
 */
export function defaultStyleSpec(): StyleSpec {
  return {
    moodPreset: '',
    brief: '',
    palette: [],
    typographyFeel: '',
    decoration: '',
    language: DEFAULT_LANGUAGE,
    refLayerIds: [],
  }
}

/* ------------------------------------------------------------------ *
 * テキストレイヤーのスタイル提案（S5.3 / dt-b9l.3）
 *
 * 中核設計（プロンプトガチャを消す）のテキスト版: ユーザーは自由文ではなく
 * StyleSpec（雰囲気）を設定し、新規テキスト追加時にアプリが決定論的に
 * フォント / 色 / 太さを出発点として提案する。その後 Inspector で自由編集できる。
 * ------------------------------------------------------------------ */

/** パレットのうち背景・余白として使われやすい白系かを判定（テキスト色選択から除外）。 */
function isBackgroundIsh(color: string): boolean {
  return /^#f{3,6}$/i.test(color.trim())
}

/**
 * typographyFeel の文字列からフォントファミリ（CSS font-family スタック）を推論する。
 * 「セリフ / 明朝」→ 明朝系、「手書き」→ 筆記系、それ以外（ゴシック/丸ゴシック等）→ ゴシック系。
 * language で日本語フォントと欧文フォントを使い分ける。
 */
export function suggestTextFontFamily(feel: string, language: string): string {
  const f = feel.toLowerCase()
  if (/(手書き|筆記|cursive|script)/.test(f)) {
    return '"Hiragino Maru Gothic Pro", "Yu Gyosho", "Noto Sans JP", cursive'
  }
  const isSerif = /(セリフ|明朝|serif)/.test(f)
  if (language === 'ja') {
    return isSerif
      ? '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif'
      : '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif'
  }
  return isSerif ? 'Georgia, "Times New Roman", serif' : 'system-ui, sans-serif'
}

/**
 * palette からテキスト色として使いやすい色を決定論的に選ぶ。
 * プリセットの palette は [メイン, アクセント, ..., 背景(白)] 順で並ぶことが多く、
 * 末尾の白は背景・余白なので除外した最初の色をテキスト色の候補とする。
 * palette が空なら既定のテキスト色（DEFAULT_TEXT_COLOR）。
 */
export function suggestTextColor(palette: string[]): string {
  const usable = palette.filter((c) => !isBackgroundIsh(c))
  return usable[0] ?? DEFAULT_TEXT_COLOR
}

/**
 * typographyFeel からフォントの太さを推論する。
 * 「太字 / 太ゴシック / ヘビー / bold / black」を含むなら 700、それ以外は 400（通常）。
 */
export function suggestTextFontWeight(feel: string): number {
  return /(太字|太ゴシック|ヘビー|bold|black)/i.test(feel)
    ? 700
    : DEFAULT_TEXT_FONT_WEIGHT
}

/** 提案されるテキストスタイル（新規 TextLayer の出発点）。 */
export interface TextStyleSuggestion {
  fontFamily: string
  color: string
  fontWeight: number
}

/**
 * StyleSpec からテキストスタイル（フォント / 色 / 太さ）を一括提案する。
 * 新規テキストレイヤー追加時に CanvasStage が呼び、得られた値を TextLayer の初期値とする。
 */
export function suggestTextStyle(style: StyleSpec): TextStyleSuggestion {
  return {
    fontFamily: suggestTextFontFamily(style.typographyFeel, style.language),
    color: suggestTextColor(style.palette),
    fontWeight: suggestTextFontWeight(style.typographyFeel),
  }
}
