---
trigger: always_on
description: sitecueのテーマ、セマンティックカラーの運用、環境ごとのUI実装ルール
---

# UI & Design Rules (sitecue Theme)

※最優先遵守事項（0ms UIシェル常時露出、二重Suspense配置規約等）については必ず `.agent/rules/core-rules.md` を参照すること。

## 1. Core Design Philosophy
- **Subtraction Aesthetics (引き算の美学)**: 不要なボーダー、過剰なシャドウ、多すぎる色数を排除し、タスクとメモ自体を主役とする。
- **Implementation Priority**: 抽象的なデザイン理念と、堅牢で業界標準な実装手法（a11y、セマンティックHTML）が競合した場合は、常に**堅牢で業界標準な実装を優先**する。
- **Responsive Safety**: UIコンポーネント修正時はPC版（`GlobalSidebar`等）とモバイル版（`MobileBottomNav`等）の両方への影響を確認すること。PC版でホバー時のみ表示される要素は、モバイル版では常時表示する等のフォールバックを実装すること。
- **データ値とUI表示値の分離**: `scope`（`exact` や `inbox`）などのDB内包値をそのまま文字列として描画してはならない。必ずユーザー向けに適切な表示ラベルへUI層で変換・マッピングしてから描画すること。

## 2. Capsule UI System & Aspect Ratio Constraints
- インタラクティブ要素（ボタン、リンク、選択トグル）は、原則としてすべてカプセル型（`rounded-full`）をデフォルト標準とする。
- 中身がアイコン単体（`size="icon"` や `size="icon-sm"` 等）の場合は、正円を物理的に維持するため `p-0 rounded-full` と縦横等価の `size-*` を指定すること。
- モーダルやダイアログ内の設定要素において、別モーダルを多重起動するネスト構造は禁止。インラインのカプセルボタン群のトグルで完結させること。

## 3. Visual Language & Semantic Colors
- **Semantic Color Usage**: Tailwind標準カラー（`bg-blue-500`, `text-red-400`等）の直接ハードコードは厳重に禁止する。必ず `globals.css` や `index.css` の `@theme` で定義されたセマンティックカラーを使用すること。
  - **Backgrounds & Borders**: `bg-base-bg` (メイン背景), `bg-base-surface` (コンテナ等), `border-base-border`
  - **Action Buttons**: `bg-action`, `hover:bg-action-hover`, `text-action-text`
  - **Note Markers**: Info (`text-note-info` / `bg-note-info`), Alert (`text-note-alert` / `bg-note-alert`), Idea (`text-note-idea` / `bg-note-idea`)

## 4. Environment Specific Rules
- **Extension (`apps/extension/`)**: ノートの一覧表示が主役であるため、視覚的ノイズを抑える徹底したモノクロームを維持。有彩色が許されるのは3種類のノートマークとシステム通知のみとする。
- **App Basecamp (`apps/app/`)**: マークダウンの可読性を高めるため、Tailwind Typography (`prose`) のトーン内での機能的な色使い（コードハイライト等）を許可する。

## 5. Favicon Integration Strategy
- ドメインや外部URLのファビコンを描画する際は、生の `<img>` タグや個別の外部API呼び出しを禁止し、必ず共通コンポーネント `<DomainFavicon domain={...} sizeClassName={...} />` を使用すること。
