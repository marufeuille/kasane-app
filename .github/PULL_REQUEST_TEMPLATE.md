<!-- 関連 bd issue: `bd show <id>` 例) dt-4n4.4 -->
**Issue:** `<id>`

## 概要

<!-- 何を・なぜ。1〜3行。 -->

## 受け入れ条件の充足

<!-- issue の acceptance criteria を 1 行ずつチェック。 -->

- [ ] 受け入れ条件1
- [ ] 受け入れ条件2

## 実装サマリ

<!-- 変更点・アプローチの要点。コミット単位で簡潔に。 -->

-

## ゲート結果

<!-- 該当するものを実行して貼る。scaffold 前で該当なしの場合は「N/A（scaffold前）」と書く。 -->

- `npm run build`:
- `npm test`:

## 動作確認手順（ローカル dev）

> このプロジェクトはデプロイを行わず、**ローカル dev server を実機で開く**運用でレビューします。
> 詳細は README の「ローカル開発・実機での動作確認」を参照。

```bash
npm install
npm run dev -- --host
```

- 起動後に端末へ表示される `Network:` URL（例: `http://192.168.x.x:5173/`）を Mac/iPad（同一 LAN）で開く。
- iPad で開く場合: Mac と同じ Wi-Fi に接続し、Safari 等で上記 Network URL を直接入力。

### 確認結果（本 PR）

<!-- 実機 or ブラウザで何を見たかを書く。 -->

- Network URL:
- 確認した画面 / 操作:

## Notes

<!-- レビュアーへの補足・後続ストーリーへの引き継ぎ・残課題。 -->
