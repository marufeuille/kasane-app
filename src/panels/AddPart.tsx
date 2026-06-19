/**
 * AddPartPanel（skeleton）— パーツ作成フロー。
 * 内容・役割入力 → Gemini 生成 → 背景除去 → レイヤー化は
 * S5.1（dt-b9l 配下）で実装する。
 */
export default function AddPartPanel() {
  return (
    <section className="panel">
      <h2 className="panel__title">Add Part</h2>
      <p className="panel__hint">内容・役割 → 生成 → 背景除去 → レイヤー化 — S5.1</p>
    </section>
  )
}
