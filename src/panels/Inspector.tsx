/**
 * InspectorPanel（skeleton）— 選択レイヤーの変形プロパティ。
 * 不透明度 / ブレンドモード / z順 は S3.3（dt-5ae 配下）で実装する。
 */
export default function InspectorPanel() {
  return (
    <section className="panel">
      <h2 className="panel__title">Inspector</h2>
      <p className="panel__hint">不透明度 · ブレンド · z順（移動/拡縮/回転は無API・即時）— S3.3</p>
    </section>
  )
}
