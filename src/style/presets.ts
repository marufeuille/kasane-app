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
import { DEFAULT_LANGUAGE, type StyleSpec } from '../types'

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
