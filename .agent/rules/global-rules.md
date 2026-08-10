---
trigger: always_on
---

# Project: sitecue Global Rules

※最優先遵守事項（Package Manager, DAL, Biome, 通信経路等）については必ず `.agent/rules/core-rules.md` を参照し遵守すること。

## 1. Overview & Architecture
sitecueは、Web活動者向けの「コンテキスト認識型メモアプリ」です。
- **Monorepo**: Turborepoを用いたモノレポ構成（`apps/` や `packages/` で管理）。
- **Extension**: React + WXT + Tailwind CSS (Chrome Extension Manifest V3) (`apps/extension/`)
- **App Basecamp**: Next.js (App Router) powered by OpenNext on Cloudflare Workers (`apps/app/`)
- **API**: Cloudflare Workers + Hono (`apps/api/`)
- **Database**: Supabase (PostgreSQL)

## 2. Type Definition Rules (型定義の絶対ルール)
- **自動生成ファイルの保護**: `packages/shared/src/types/supabase.ts` は `bun x supabase gen types` で自動生成されるファイルである。AIによる直接手動編集は**絶対禁止**。
- **型のラップとSSOTの集約**: DBの自動生成型で単なる `string` になる型（例: `sitecue_notes` の `scope`）は、すべて `packages/shared/src/types/app.ts` にて厳密なユニオン型（`'exact' | 'domain' | 'inbox'`）として定義・ラップされている。型定義の情報源はここを唯一の正（SSOT）とする。
- **リソース制限定数のSSOT集約**: リソース制限（ノート・ドラフト・AI等）は、必ず `@sitecue/shared`（`packages/shared/src/utils/limits.ts`）を参照すること。
- **コンポーネントからの参照**: UIコンポーネントやHooksから型を `import` する際は、必ず `@sitecue/shared` からインポートすること。

## 3. Code Quality & Biome Supplementary Rules
※基本原則（`any` 禁止、`!` 禁止、`useEffect` 依存配列、`noArrayIndexKey`）は `core-rules.md` を参照。
- **アクセシビリティ (a11y)**: `<button>` には必ず `type` 属性 (`type="button"` または `type="submit"`) を明記。装飾用 `<svg>` には `aria-hidden="true"` を付与すること。
- **未使用変数**: コールバック引数などで意図的に使用しない変数は、アンダースコア `_` を付与すること（例: `_err`）。
- **型チェックの徹底**: Biomeによるチェックに加え、コード修正後は対象ワークスペースにて `bun x tsc --noEmit` を実行して型整合性を必ず確認すること。

## 4. Impact Analysis (インパクト・アナリシス)
実装を開始する前に、以下のインパクト・アナリシスを実施し、その結果を思考プロセスに含めること。
- **依存グラフの確認**: 変更対象のコンポーネントや関数が参照されている範囲（Extension / App双方含む）を特定する。
- **副作用の予測**: UI/UX（レイアウト・アクセシビリティ）、データ/状態（TanStack Queryキャッシュ・URLパラメータ）、パフォーマンスへの影響を予測する。
- **DB Migration**: マイグレーション作成時は、適用コマンドの実行依頼または手動実行報告を完了時に明記する。
