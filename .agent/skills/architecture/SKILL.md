---
trigger: always_on
description: システム間連携、ネットワーク構成、Cloudflare Workers、およびインテグレーションの専門ルール
---

# Architecture & Integration Patterns

※最優先遵守事項（IPv4/8787固定、Workersデプロイコマンド等）については必ず `.agent/rules/core-rules.md` を参照すること。

## 1. システム間データ連携 (ワンタイム・データリレー)
拡張機能から App Basecamp へ巨大データ（ページテキスト等）を渡す標準パターン:
1. **Storage (Extension ➔ DB)**: Supabase の `sitecue_page_contents` テーブルへ直接 `INSERT` し `context_id` (UUID) を取得。
2. **Relay (Extension ➔ App)**: `context_id` を URL パラメータ（`?context_id=...`）に付与して App Basecamp を開く。
3. **Consume & Cleanup (App ➔ API ➔ DB)**: API (Hono) でデータを `SELECT` した後、**直ちに該当レコードを `DELETE`** してゴミを残さないこと。

## 2. Cloudflare Workers & OpenNext 環境設定
- **公開変数 (`NEXT_PUBLIC_`)**: ビルド時インライン化のための `.env.production` と、デプロイ後 Worker ランタイムのための `wrangler.toml` の `[vars]` の両方に記述すること。
- **機密キー**: `wrangler.toml` に直接書かず、`bun x wrangler secret put <KEY_NAME>` を使用すること。

## 3. ドメイン・サブドメイン戦略
- **App Basecamp (Next.js)**: `app.sitecue.app`
- **API (Hono)**: `api.sitecue.app` (CORS厳格管理)
- **LP (予約)**: ネイキッドドメイン `sitecue.app`

## 4. 認証・BFCache・リダイレクト規約
- **OAuth ボタンの BFCache 対策**: ログインボタンに `useState` のローカルローディング状態を持たせることは禁止（ブラウザバックでボタンが無効化固定されるため）。HTML `<form>` と Server Actions (`"use server"`) を用いること。
- **SPA ナビゲーションの維持**: 認証転送時は `window.location.replace` を使わず、`router.replace()` または SSR リダイレクトを使用すること。
- **認証境界ページの動的指定**: `/login` 等では Router Cache による古い状態表示を防ぐため `export const dynamic = "force-dynamic";` を明示すること。

## 5. 生成AIクオータ・コストガード構造
1. **DB管理**: `sitecue_profiles` で月間利用回数 (`usage_count`) とリセット日時を管理。
2. **API絶対ガード**: Hono API 側で上限チェックを行い、到達時は `403 Forbidden` と現在のプラン情報を返却。
3. **Heavy / Light タスク分離**:
   - **Heavy (Weave, Review等)**: 回数を消費。
   - **Light (Hint等)**: UIカウントからは除外し実質無制限（内部 Rate Limit で保護）。
