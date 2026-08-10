# App Basecamp（Next.js）の拡張ルール

## 1. 独立ルーティング（隔離）の原則

App Basecamp（`apps/app/`）に新しい機能や画面を追加する場合、既存のページ（`/app/page.tsx` など）のUIを直接改修して複雑化させることは厳禁です。
必ず Next.js の App Router の仕組みを利用し、**完全に独立した専用ページ（特設ルーム）** として作成してください。

- **Bad:** 既存の `apps/app/src/app/page.tsx` の中に、モーダルや条件分岐で新しいAI機能をねじ込む。
- **Good:** `apps/app/src/app/studio/page.tsx` のような新しいルーティングを作成し、既存のコードと物理的に切り離す。

## 2. コンポーネントの隔離 (Feature Colocation)

新機能専用のコンポーネントは、共通の `_components/` ディレクトリに漫然と混ぜるのではなく、必ず機能ごとにディレクトリを切って隔離してください。

- **Bad:** Studio画面専用の `PaywallModal.tsx` を `apps/app/src/app/_components/` に置く。
- **Good:** Studio画面専用のコンポーネントは `apps/app/src/app/studio/_components/` を作成してそこに閉じ込める。
- **理由:** 特定のページにしか依存しないサブコンポーネントを機能単位で隔離（Colocation）することで、将来的なリファクタリング時の影響範囲を限定し、コードの肥大化を防ぐため。


## 3. アトミックな機能実装

新機能を追加する際は、App Basecamp（UI）の追加と API（Hono）の追加を1つのプロンプト・1つのコミットで同時に行わないこと。
まずはUIのモックアップ（箱）だけを独立したルーティング上に作り、その後のステップでAPIとの繋ぎ込みを行う「Expand & Contract パターン」を意識してください。

## 4. App Router & OpenNext ビルド制約 (Suspense Rule)

- **`useSearchParams` のラップ必須化**:
  Client Component (`"use client"`) 内で `useSearchParams()` フックを使用する場合、そのコンポーネントまたは呼び出し元を必ず React の `<Suspense fallback={...}>` でラップしてください。
  これを行わないと、OpenNext のビルドプロセス中の静的生成 (Prerendering) がクライアント側のパラメータに依存してしまい、ビルドが完全に失敗します。
- **自己完結型Suspense境界の推奨**:
  パフォーマンス向上のためSSR/SSGの恩恵を最大化しつつ、CSRへの強制フォールバックエラーを防ぐため、可能な限りコンポーネント単位で `<Suspense>` を配置してください。
- **引き算の美学 (Fallback) と 0ms UI シェル ＆ SWRBoundary 局所保護の掟**:
  `.agent/rules/ui-rules.md` に従い、Suspense の `fallback` には原則として `null` または最最小限の表示を指定し、レンダリング時のチラつきを最小限に抑えてください。
  **【🚨 loading.tsx 物理削除と 0ms UI シェル常時露出の原則】**
  主要ページ（Launchpad, Studio, Notes等）において、ルート直下に `loading.tsx` を配備してはならない。`loading.tsx` が存在すると、SPA遷移や `router.replace` 実行時に Next.js が画面全体のコンテナ（AppShellや枠組み）ごとアンマウントして全画面スケルトンへ強制置換し、画面の激しいチラつきやレイアウトシフトを発生させるためである。
  初期ロードコストが高い画面においては、RSC（`page.tsx`）側で重い DB 通信や `requireUser` などの同期通信・パラメータ待機を行わず、最速で外殻（ヘッダーや枠組み）を 0ms で即時レンダリング返却（Unblocked Shell）し、内部の動的コンテンツ領域のみを `<SWRBoundary>` で部分保護・スケルトン化することを絶対標準アーキテクチャとする。


## 5. Server Component Constraints (RSCの掟)
- **イベントハンドラの禁止**: `page.tsx` や `layout.tsx` などの Server Component 内で、直接 `onClick` や `onChange` などのイベントハンドラを記述したり、`useState` などの React Hooks を呼び出したりすることは**厳禁**。
- **解決策 (Expand & Contract)**: ボタンのクリックによるトースト通知や状態変更など、インタラクティブな処理が必要な場合は、そのボタン部分のみを純粋な Client Component (`"use client"`) として別ファイル（例: `_components/HogeButton.tsx`）に切り出し、Server Component にインポートして配置すること。
- **RSC Top-level Blocking の禁止**: ダッシュボード等のポータルページにおいて、すべての通信フェッチや `requireUser` / `searchParams` 待機を親の `page.tsx` 直下で `await` してSSRレスポンスを止める実装を禁止する。RSCPayload の返却自体を遅延させないため、`page.tsx` 側での同期待機を全撤廃し、0ms で Client Component（UIシェル）を即時返却すること。
- **ローカルURLに対する外部 Favicon API リクエストの遮断**: `localhost`, `127.0.0.1`, `0.0.0.0`, `.local` 等のローカルドメインに対しては、Google Favicon API 等の外部ネットワーク通信を呼び出さず、専用のフォールバックアイコン (`Laptop`) を返すこと。
- **RSC Top-level Blocking 回避 (0ms UI シェル即時返却の掟)**:
  `middleware.ts` が全ルート保護をエッジレベルで完結させ、Supabase RLS が DB 層で認可を絶対担保しているため、`page.tsx` (RSC) 側で `requireUser()` や `searchParams` などの非同期・同期待機を行ってはならない。Next.js の Concurrent Navigation によりページ全体（RSC Payload）の返却自体がブロック（Top-level Blocking）され、画面遷移時に固定フリーズ感が生じるのを防ぐため、最速で Client Component（UIシェル）を 0ms 即時返却すること。

## 6. Route Protection & Auth Constraints (多層防御の掟)
- **オプトアウト方式の Middleware**:
  Middleware（`middleware.ts`）でのルート保護は、ホワイトリスト（公開ルート）を定義し、「それ以外のルートはすべてデフォルトで保護対象（ログイン必須）」とするオプトアウト方式を維持すること。手動で保護ルートを列挙（オプトイン）してはならない。
- **Data Access Layer (DAL) による二重チェック**:
  Middlewareによる保護に加え、ログインが前提となるすべての Server Component（`page.tsx` 等）において、他のDBクエリを実行する前に必ず `requireUser()` などの共通認証ユーティリティを呼び出すこと。
  未認証時は早期リターンで即座に `redirect('/login')` などを発火させ、RLSによる空データの描画（Ghost UI）を確実に防ぐ。
- **`getUser()` の絶対使用**:
  セッションの有効性をサーバー側で正確に検証するため、認証ユーティリティの内部では `getSession()` ではなく、必ず `supabase.auth.getUser()` を使用すること。

## 7. App Shell Preservation & Layout Suspense Boundary Rules
- `apps/app/src/app/(dashboard)/layout.tsx` において、`<AppShell>`（固定左サイドバー・ナビゲーション等を含む外殻）は絶対に `<Suspense>` の内側に配置してはならない。
- `<Suspense>` 境界は必ず `<AppShell>` の内側で `{children}`（メイン領域）のみを包むように配置し、下位セグメントでの Server Component の `await` 待機処理が発生しても外殻（App Shell）が丸ごとアンマウント・白画面化しない構造を絶対防衛すること。

## 8. 0ms Tab Navigation Rule
App Basecamp の同一画面内におけるタブ切替・ローカルコンテキスト切替（ドリルダウン・戻る操作）時は、`startTransition` や `replaceState` 直書きハックを行わず、Next.js 標準の `router.replace(url, { scroll: false })` を用いて一貫してナビゲーションを行うこと。これにより Next.js の `useSearchParams()` を唯一の SSOT として維持しつつ、インメモリキャッシュから 0ms で即時UI描画を行うこと。また、タブ切替時には対象ペインのスクロールリセット（`scrollTop = 0`）を同時に実行すること。

## 9. Studio画面における0msシェル描画とSWRBoundary適用規則
Studio 画面（Draft / Diary）への画面遷移時、Server Component 側で詳細データのフェッチ待機を行って画面全体を Suspense/`loading.tsx` でブロックしてはならない。
- **UIシェルの即時返却**: RSC 側は最速で認証ガード (`requireUser`) のみを通過させ、ヘッダーやレイアウト枠組み（UIシェル）を 0ms で即時レンダリング返却すること。
- **データ依存部の保護**: エディタ本文やレビュー領域などの動的コンテンツ領域のみを `<SWRBoundary>` で保護する。キャッシュが存在する場合はスケルトンをバイパスして 0ms 表示し、キャッシュ無しのフェッチ時は 200ms ホールドによる視覚的チラつき防止を行う。
- **router.refresh() の完全排除**: 保存処理（Save Draft / Save Diary）における `router.refresh()` や Server Component の再検証を完全に排除し、TanStack Query の `setQueriesData`（プレフィックス一致）による手元キャッシュ一括分配でUIとサーバー状態の同期を完結させること。

## 10. RSC サスペンドの最外殻漏れ出し防止則
`(dashboard)/layout.tsx` などの共通最外殻レイアウトには、`{children}` 全体を包む大雑把な `<Suspense fallback={null}>` を配置してはならない。サスペンドの受け皿（Suspense 境界）は必ず各機能ページ（`page.tsx` または `_components` 内）の最も狭いデータ依存領域へ閉じ込めること。

**RSC サスペンドの最外殻漏れ出し防止とスケルトンシェル保護の掟:** `(dashboard)/layout.tsx` 等の最外殻レイアウトや各機能ページのトップレベルで `{children}` 全体を包む大雑把な `<Suspense fallback={null}>` を配置してはならない。サスペンド時も UI シェル（ヘッダー・フレーム）は 0ms で常時アタッチさせ、サスペンド受け皿はデータに依存する内部領域のみへ閉じ込めること。

## UI シェル常時固定と局所データサスペンドの規約
ヘッダー、タブ、検索窓、ペインレイアウト等の固定枠組み（UI シェル）はサスペンド境界の外側に 0ms 常時表示で固定すること。`useSearchParams()` を使用するページコンポーネント（`page.tsx`）の最外殻 Suspense は Next.js 15 ビルド要件（`useSearchParams` の CSR Bailout 防止）を満たすセーフティネットとし、データ依存スロット（リスト本文・エディタ）内部のみに `<SWRBoundary>` および局所 `<Suspense>` をカプセル化配置すること。

## Diary Studio における UI シェル固定と局所サスペンド境界の規約
`/diaries/[date]` 画面において、ヘッダー（タイトル、日付、Saveボタン）、左右パネルのレスポンシブ枠組み、およびトピック操作エリアはサスペンド境界の外側に 0ms 常時表示で固定すること。`<Suspense>` および `<SWRBoundary>` は `StudioEditor` 本文領域および `DiaryMaterialsPane` リスト領域のみに局所配置し、最外殻サスペンドへの巻き込み全画面消去を防止すること。

## Weave Studio における UI シェル固定と局所サスペンド境界の規約
`/studio/[id]` および `/studio/new` 画面において、ヘッダー（`DraftEditorHeader`）、タイトル/slug入力領域、および左右パネルのレスポンシブ枠組みはサスペンド境界の外側に 0ms 常時表示で固定すること。`<Suspense>` および `<SWRBoundary>` は `StudioEditor` 本文領域、`StudioMaterialsPane` リスト領域、および `StudioReviewPane` リスト領域のみに局所配置し、最外殻サスペンドへの巻き込み全画面消去を防止すること。

## テンプレート管理における UI シェル固定と局所サスペンド境界の規約
`/templates` 画面において、左ペインヘッダー（Launchpad戻るボタン、「Templates」タイトル、`+`ボタン）およびペインフレームはサスペンド境界の外側に 0ms 常時表示で固定すること。`<Suspense>` および `<SWRBoundary>` はテンプレート一覧リスト領域および右ペイン/モバイルDrawer内のエディタ領域（`EditorContent`）のみに局所配置し、`if (isLoading) return null;` による全画面消去や最外殻サスペンドへの巻き込み全画面置換を防止すること。

## トップページおよび主要機能ビューにおける UI シェル 0ms 常時表示とデータスロットごとの `<Suspense>` ＋ `<SWRBoundary>` ペア配置規約
トップページ (`/`) および主要機能ビューにおいて、最外殻コンテナレベルでの単一 `<SWRBoundary>` による一括置換や全画面スケルトン適用は、UIシェル（セクション見出しやレイアウト枠組み）の消去およびサスペンド信号の最外殻バブリングを引き起こすため**絶対禁止**とする。
最外殻コンテナはデータフェッチの成否に関わらず 0ms 即時表示の UI シェルとして描画し、動的データ依存領域のみを複数の「データスロット」として物理切り出しすること。各データスロット内には、必ずサスペンドを捉える `<Suspense>` と、キャッシュ保持・最低表示タイマーを司る `<SWRBoundary>` を**ペアでカプセル化配置**しなければならない。