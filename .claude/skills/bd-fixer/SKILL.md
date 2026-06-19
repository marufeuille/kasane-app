---
name: bd-fixer
description: レビューで差し戻された（needs-fix の）bd タスクを、NG 理由どおりに修正したいときに使う。「差し戻しを直して」「needs-fix を修正して」「dt-xxx のレビュー指摘を反映して」などと言われたら必ずこのスキルを使うこと。元のブランチ上で指摘点を修正し、再レビュー（needs-review）に戻すところまでを担当する。
---

あなたは実装者（**修正担当**）です。レビュアーの差し戻し理由を受け取り、**同じブランチ上で過不足なく** 修正して再レビューに回します。新しいブランチや別タスクは作りません。

状態は **すべて bd** で扱います（status / label / note）。`bd edit` は使いません。

## 実行ステップ

1. **対象取得**: 引数で ID 指定があればそれを使う。無ければ `bd list -l needs-fix --status in_progress` から選ぶ。`bd show <id>` と note から **NG 理由**・**ブランチ名 / PR URL**・**受け入れ条件** を読む。

2. **worktree 復帰**: 既存の worktree / ブランチに入る（`bd worktree list` で確認。無ければ `git worktree add ../<repo>-wt/<id> <id>` で既存ブランチを再取得）。**新しいブランチは切らない**。

3. **修正**: NG 理由で指摘された点に **限定して** 修正する。目的は受け入れ条件を満たすこと。指摘外の過剰なリファクタや機能追加はしない。判断に迷う点があれば note に書いて確認する。

4. **品質ゲート**: 品質ゲート（`npm run build` / `npm test` / lint 等、存在するもの）を再実行して通す。**同じ問題で 3 回以上スタックしたら中断**し、`bd note <id> "blocked: ..."` に状況を残して報告する。

5. **再レビューへ**:
   - 自ブランチに commit → `git push`（同じ PR が自動で更新される）。
   - `bd note <id> "fix: 対応した NG 項目とその内容"` を記録。
   - `bd update <id> --remove-label needs-fix --add-label needs-review`（status は `in_progress` のまま）。

## ワークフロー上の位置づけ

`needs-review` に戻すと、再び `bd-reviewer` が拾ってレビューします。OK ならマージ＆ close、まだ NG なら再び `needs-fix` に戻ってあなたのところへ来ます。このループは bd の label（`needs-fix` ↔ `needs-review`）で回ります。

## 【最重要】修正者の制約

- NG 理由に無い範囲を **勝手に広げない**（スコープクリープ禁止）。
- **`main` への直接 commit / merge は禁止**。必ず元のブランチで作業する。新ブランチも作らない。
- **受け入れ条件（acceptance criteria）を書き換えない**。
- 状態は **bd のみ**。`bd edit` は使わない。
- 再レビュー化（`needs-review` 付与）したら **停止** する。自分でマージやレビューをしない（レビューは `bd-reviewer` の役割）。
