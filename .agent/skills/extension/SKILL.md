---
trigger: always_on
description: Chrome拡張機能（WXT/Manifest V3）、OAuth認証、ゲストモード、および日記統合の専門ルール
---

# Extension Architecture & Integration Rules

※最優先遵守事項（Supabase直接通信、DAL利用、ホスト権限最小化等）については必ず `.agent/rules/core-rules.md` を参照すること。

## 1. Shared Logic & Service Worker Rules
- **DOM 依存の警戒**: `background.ts` (Service Worker) から DOM API (`window`, `document`) 依存コードを呼び出すとクラッシュする。URL正規化やタグ抽出は必ず純粋な `@sitecue/shared` からインポートすること。
- **Dynamic Permissions**: `<all_urls>` の一括要求は禁止。必要時は `optional_host_permissions` に定義し `browser.permissions.request` で動的要求すること。

## 2. Authentication & Isolation
- **OAuth (WebAuthFlow)**: 拡張機能内の認証は `chrome.identity.launchWebAuthFlow` を使用すること。`options.redirectTo` には `chrome.identity.getRedirectURL()` を指定し、Google ログイン時は `prompt: 'select_account'` を付与すること。
- **タブスコープの隔離**: お気に入りノートであっても他タブへ無条件侵入させてはならない。現在の `viewScope` および `url_pattern` と照合して描画決定すること。
- **ゲストモード**: ゲストのデータは `chrome.storage.local` に隔離し上限50件とする。初期化ハング防止のため、認証チェックには 200ms サーキットブレーカーを配備すること。

## 3. Diary Integration & Input UX
- **アトミック保存 ＆ サイレント更新**: 日記の作成・追記は共通 DAL (`appendDiaryLog` 等) を使用すること。保存は 3秒デバウンス / onBlur による完全サイレント保存とし、保存成功時は 0ms 楽観的 UI で閲覧モードへ移行すること。
- **Pill-Input 構造**: 入力ブロックは `grid grid-cols-[auto_1fr_auto] items-center gap-3` のカプセル型構造とし、Textarea には `max-h-24 overflow-y-auto` を指定すること。
- **極上エディタ入力補助**: リスト行（`- `, `1. `）での Tab は行頭インデント、空バレットでの Enter はクリーンな改行（`\n`）スライド着地とすること。バッククォート（` ` `）の自動閉じはコードブロック保護のため除外すること。
