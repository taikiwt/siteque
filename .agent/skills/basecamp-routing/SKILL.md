# App Basecamp（Next.js）Routing & Layout Rules

※最優先遵守事項（0ms UIシェル常時露出、二重Suspense配置規約等）については必ず `.agent/rules/core-rules.md` を参照すること。

## 1. 独立ルーティングと機能隔離 (Feature Colocation)
- **独立ルーティングの原則**: 新機能や特設画面を追加する際は、既存の `page.tsx` に条件分岐でねじ込まず、必ず App Router の独立したルート（例: `apps/app/src/app/studio/page.tsx`）として作成・物理隔離すること。
- **Feature Colocation**: 特定の機能ページでのみ使用するコンポーネントは、共通の `_components/` ではなく、該当ページ直下の `_components/`（例: `app/studio/_components/`）に配置して閉じ込めること。

## 2. App Router & Suspense 境界規約
- **`useSearchParams` の Suspense ラップ**: Client Component 内で `useSearchParams()` を使用する場合は、OpenNext の Prerender バイルアウトを防ぐため、必ず呼び出し元または直上を `<Suspense fallback={...}>` で包むこと。
- **最外殻レイアウトのサスペンド防御**: `(dashboard)/layout.tsx` の `<AppShell>` 外殻を `<Suspense>` の内側に配置してはならない。`<Suspense>` 境界は必ず `{children}`（メイン領域）の内側のみを包むように配置すること。
- **`loading.tsx` の配置禁止**: 主要ページルート直下に `loading.tsx` を配置してはならない。SPA遷移時に画面全体のコンテナがアンマウントされ、全画面スケルトン置換のチラつきが発生するためである。

## 3. Server Component (RSC) コンストレイント
- **イベントハンドラの禁止**: `page.tsx` や `layout.tsx` などの Server Component 内で、直接 `onClick` や `onChange` 等のイベントハンドラを記述したり `useState` 等の Hooks を呼び出すことは厳禁。必要部分は Client Component (`"use client"`) へ切り出すこと。
- **RSC Top-level Blocking の禁止**: `page.tsx` (RSC) 直下で `requireUser()` や `searchParams` などの非同期待機を行って RSC Payload 返却自体を遅延させてはならない。0ms で Client Component（UIシェル）を即時返却すること。

## 4. 画面別 0ms シェル ＆ データスロット構造指針
- **Launchpad (`/`)**: 最外殻グリッド・セクション見出しを 0ms 即時表示し、`TopSectionSlot`, `DomainActivitySlot`, `ActivityLogSlot` へ `<Suspense>` ＋ `<SWRBoundary>` をペア配置する。
- **Studio (`/studio/[id]`)**: ヘッダー（`DraftEditorHeader`）、タイトル/slug入力領域を 0ms 即時表示し、`StudioEditor`, `StudioMaterialsPane`, `StudioReviewPane` のみ局所サスペンド保護する。
- **Diaries (`/diaries/[date]`)**: ヘッダー、レスポンシブ枠組みを 0ms 即時表示し、`StudioEditor` および `DiaryMaterialsPane` のみ局所サスペンド保護する。
- **Templates (`/templates`)**: 左ペインヘッダーおよびフレームを 0ms 即時表示し、リスト領域およびエディタ領域のみ局所サスペンド保護する。

## 5. Navigation & Context Rules
- **0ms Tab Navigation Rule**: 同一画面内でのタブ切替・ローカルコンテキスト切替時は、`router.replace(url, { scroll: false })` を使用し、`useSearchParams()` を唯一の SSOT として即時描画を行うこと。切替時は対象ペインのスクロールをリセット（`scrollTop = 0`）すること。
- **オプトアウト方式の Middleware**: `middleware.ts` でのルート保護はホワイトリスト定義によるオプトアウト方式を維持し、未認証時は DAL 層の `requireUser()` との二重チェックで保護すること。
