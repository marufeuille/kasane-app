# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## プロジェクト概要

**Kasane Studio** — Gemini（nano banana / `gemini-2.5-flash-image`）を使った広告画像オーサリングツール。
（表示名: Kasane Studio / 短縮: Kasane / パッケージ・リポジトリ名: `kasane-studio`）
名前の由来はレイヤーを「重ねる」という本ツールの中核操作。狙いは「プロンプトガチャ」を消すこと。

**中核設計: 生成と配置・微調整を分離する**
- Gemini は「パーツの見た目生成」と「写真全体加工」に専念
- 配置 / 移動 / 拡縮 / 回転 / 透過(不透明度) は **ローカルのレイヤーキャンバスで即時・無API**
- `StyleSpec`（雰囲気）を一度設定し全パーツ生成に自動注入＋既存パーツを参照画像化して統一感を出す
- ユーザーは自由文でなくフィールド入力 → アプリが決定論的にプロンプトを組み立て、再現性を担保

**確定方針**: PWA（Mac/iPad）/ 合成は **ハイブリッドのみ**（最終Gemini再合成パスは作らない）/
テキストは **両対応**（AI焼き込み・実フォント）/ LLMは **BYOK**（まずGeminiのみ）/
MVP最優先は **レイヤー微調整(E3)** と **統一感スタイル指定(E4)**。

**技術前提**: 出力はインライン base64 PNG。aspectRatio(1:1/4:5/9:16/16:9)・解像度1K/2K指定可。
参照画像は最大10枚。透過(アルファ)出力は非保証 → ブラウザ内背景除去（`@imgly/background-removal`）で担保。
ブラウザ直叩きはCORS懸念 → dev proxy／個人用 Cloudflare Worker でフォールバック。BYOKキーはローカル(IndexedDB)保存。

詳細設計は plan: `~/.claude/plans/gemini-mutable-rabbit.md` の付録を参照。

## 技術スタック / ファイル構成

React + TS + Vite + `vite-plugin-pwa` / Konva.js + react-konva（レイヤー&Transformer）/
Zustand / Dexie(IndexedDB) / `@imgly/background-removal` / Gemini は `:generateContent` の薄ラッパ。

```
src/
  types.ts  state/store.ts  db/db.ts
  gemini/{client,prompt}.ts          # client=疎通, prompt=assembleStylePrompt
  style/presets.ts  bg/removeBackground.ts
  canvas/{CanvasStage,LayerNode}.tsx # react-konva + Transformer
  panels/{Style,AddPart,Layers,Inspector,Settings}.tsx
  export/exportImage.ts  App.tsx  main.tsx
```

## Build & Test

まだ scaffold 前（最初の着手対象 S1.1 で雛形を作る）。完了後は以下を想定:

```bash
npm install
npm run dev -- --host   # iPad から同一LANで開いて実機確認
npm run build           # PWA ビルド（ホーム画面インストール確認）
```

## 作業の進め方（bd でのタスク管理）

このプロジェクトの作業は **すべて bd（beads, prefix `dt`）で管理** する。
ad-hoc な TODO ではなく bd の issue として扱い、**実装前にバックログを立ててから着手** する方針。

**バックログ構造**（エピック → ストーリー、`--parent` で親子化）:
- `dt-4n4` E1 基盤・雛形 / `dt-kd9` E2 Geminiクライアント / `dt-5ae` E3 レイヤー編集[MVP] /
  `dt-tud` E4 スタイル統一[MVP] / `dt-b9l` E5 パーツ作成 / `dt-48a` E6 出力&PWA
- MVP対象は `mvp` ラベル（`bd list -l mvp`）、優先度 P0〜P2
- **依存はストーリー間で張る**（エピックはブロック依存に使えず親子のみ）

**基本フロー**:
```bash
bd ready                                  # 今やれる最小タスク（最初は S1.1 = dt-4n4.1）
bd show <id>                              # 詳細
bd update <id> --status in_progress       # 着手
bd close <id>                             # 完了（→次が ready に浮く）
bd list -l mvp                            # MVPだけ
bd dep tree <id>                          # 依存ツリー
```
- ストーリー内の細タスクは着手時に `bd create --parent <story> --deps 'discovered-from:<story>'` でぶら下げる。
