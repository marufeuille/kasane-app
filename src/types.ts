/**
 * Kasane Studio — 共通型定義の雛形（skeleton）。
 *
 * 完全なデータモデル（Project / Layer / Transform / StyleSpec / Generation 等）は
 * 後続ストーリー S1.2（dt-4n4.2: types定義 + Dexie + Zustand）で実装する。
 * ここでは後続ストーリーが依存する最小の識別子のみを置き、循環参照を避ける。
 */

/** レイヤー種別。photo=背景写真, ai-part=Gemini生成パーツ, text=実フォントテキスト。 */
export type LayerKind = 'photo' | 'ai-part' | 'text'

/** 広告出力サイズのアスペクト比プリセット（plan の技術前提に準拠）。 */
export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9'

/** 出力解像度（Gemini 生成時の 1K / 2K 指定に対応）。 */
export type Resolution = '1K' | '2K'
