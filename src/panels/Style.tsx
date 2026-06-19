/**
 * StylePanel（skeleton）— 雰囲気指定（StyleSpec）の入力 UI。
 * brief / mood プリセット / palette / typography feel は
 * S4.2（dt-tud 配下）で実装する。
 */
export default function StylePanel() {
  return (
    <section className="panel">
      <h2 className="panel__title">Style</h2>
      <p className="panel__hint">雰囲気（mood / palette / brief）を一度設定し、全パーツ生成に注入 — S4.2</p>
    </section>
  )
}
