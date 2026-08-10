---
trigger: always_on
description: Supabase、RLS、マイグレーション、およびデータ操作に関する専門ルール
---

# Database Operations & Rules

※最優先遵守事項（DALの強制、Additive Changesのみ等の絶対ルール）については必ず `.agent/rules/core-rules.md` を参照すること。

## 1. SSOT (Single Source of Truth) とデータ型規約
- **型定義の参照**: スキーマ構造やEnum値は、手動コードやドキュメントを推測せず、必ず `packages/shared/src/types/` 配下を参照すること。
- **日付SSOT**: 時差ズレを防ぐため、日付（`date`）は常にブラウザローカルタイムゾーンに基づく `YYYY-MM-DD` 形式のプレーン文字列としてDALへ渡し、完全一致で保存・判定すること。
- **Diaries アトミック追記仕様**: 初回入力は `[HH:MM]\n本文`、同一日の追記時は既存本文の末尾に改行2つ（`\n\n`）を挟んで `[HH:MM]\n本文` をアトミック結合し `upsert` すること。
- **Slim Fetching**: ノート一覧等は本文を除いた `NoteMetadata` 型で軽量フェッチし、詳細・編集時に完全な `Note` 型へハイドレーションすること。

## 2. データ操作のベストプラクティス
- **Fractional Indexing**: 順序管理（`sort_order`）は double precision を用いた Fractional Indexing を標準とし、単一レコードの `update` のみで完結させること（配列の一括更新禁止）。
- **N+1 クエリ排除と RPC 活用**: ダッシュボード等の複雑な階層データ取得は、PostgreSQL の `JSON_AGG` 等を活用した単一 RPC 関数を作成して一括取得すること。
- **楽観的UIの採番対称性**: 新規作成時の仮 `sort_order` は、DB側の採番（最上部挿入なら `Math.min(...) - 1.0`）と完全に一致させ、ワープ現象を物理排除すること。

## 3. マイグレーション ＆ セキュリティ (RLS)
- **マイグレーション手順**: ローカルで変更テスト後、`supabase/migrations` にSQLを作成し、`bunx supabase db dump --local > supabase/schema.sql` でスキーマを最新化すること。
- **RLS (Row Level Security)**: 全テーブルで RLS を有効化し、`auth.uid() = user_id` によるアクセスポリシーを必須とすること。
- **PostgREST インジェクション対策**: `.or('column.eq."${val}"')` などの文字列連結クエリはパースエラーや脆弱性の原因となるため禁止。複雑な OR 条件は DB 側に RPC を作成してパラメータ渡しすること。
- **PostgrestError の型判定**: `catch (err: unknown)` 内では `typeof err === 'object' && err !== null && 'message' in err` のプロパティチェックでメッセージを取得すること（`instanceof Error` 単体判定は不可）。
