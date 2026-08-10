---
trigger: always_on
description: sitecue開発における最優先遵守事項（絶対防壁・開発ルール）
---

# 🚨 sitecue Core Rules (最優先遵守事項)

AI（Gemini / Claude / Antigravity等）は、いかなる理由であっても本ファイルに記載されたルールを例外なく絶対遵守しなければならない。推測や独自の文脈判断による変更・スキップは固く禁ずる。

---

## 1. 開発環境・ツールチェーンの絶対制約
- **Package Manager:** パッケージマネージャーは **Bun** のみ使用すること。`npm`, `yarn`, `pnpm` の使用および自動コマンド提案は**厳禁**。
- **Local Network:** API (Wrangler/Hono) と App Basecamp (Next.js) 間のローカル通信は、IPv4/IPv6のすれ違いを防ぐため **必ず `127.0.0.1` を使用**すること。`localhost` の使用は禁止。APIポートは `8787` で固定すること。
- **Code Quality (Biome):** `any` 型の使用禁止、Non-Null Assertion (`!`) 禁止、`useEffect` 依存配列の完全指定、`noArrayIndexKey`（インデックスKeyの禁止）を徹底すること。型チェックは `bun x tsc --noEmit` を併用すること。

---

## 2. アーキテクチャ・通信経路・DALの絶対ルール
- **DAL (Data Access Layer) の強制:** アプリ層（`apps/`配下）からの `supabase.from()` 直接呼び出しは**厳禁**。DBアクセスは必ず `@sitecue/shared`（`packages/shared/src/dal/`）の共通関数を経由すること。
- **Extension 通信:** 拡張機能は Supabase と直接通信する。自社 DB CRUD のために `apps/api/` (Hono) を経由させてはならない。
- **Cloudflare Workers & OpenNext:** `export const runtime = "edge";` の記述は禁止。デプロイは `bun run deploy` を使用すること。
- **DB Migration:** 既存スキーマを破壊しない「追加のみ（Additive Changes）」を原則とする。

---

## 3. UIシェル 0ms 表示 ＆ 局所 Suspense/SWRBoundary 二重防壁規約
- **0ms UIシェルの常時露出:**
  ヘッダー、タブ、検索窓、セクション見出し、レイアウト枠組み（UIシェル）は、データフェッチの成否に関わらず 0ms で常時表示（Unblocked Shell）させること。画面全体をスケルトンで覆い隠したり `isLoading` でコンテナごとアンマウントしてはならない。
- **データスロットごとの局所 `<Suspense>` ＋ `<SWRBoundary>` ペア配置:**
  データ依存領域（データスロット）の呼び出し位置には、**必ず個別で `<Suspense>` と `<SWRBoundary>` をペアで配置**すること。
  ```tsx
  <Suspense fallback="{<SlotSkeleton"/>}>
    <SWRBoundary data="{slotData}" fallback="{<SlotSkeleton"/>} isLoading={isLoading}>
      {(data) => <SlotContent data="{data}"/>}
    </SWRBoundary>
  </Suspense>
  ```
- **【🚨重要防壁】意図しないサスペンド状態への絶縁体（フェイルセーフ）:**
  本配置は、フレームワーク内部挙動やライブラリ起因の「原因不明の再フェッチ」や「意図しないサスペンド状態」が発生した場合でも、**その影響（画面消去・スケルトン表示）を対象スロット内へ物理的に完全隔離・限定化させるための絶対的な絶縁体（安全装置）**である。
- **【🚨絶対禁止】AIによる独断的スキップの遮断:**
  AIが「親（`page.tsx` 等）に Suspense があるから不要」「今回の設計では再フェッチが発生しないため不要」「SWRBoundary だけで十分」といった**独自の文脈判断で個別の `<Suspense>` 配置を省略・削除することは一切禁止する**。
- **【🚨絶対禁止】200ms スケルトン保持（`SKELETON_HOLD_MS`）の変更・削除:**
  `<SWRBoundary>` 内の `SKELETON_HOLD_MS = 200` は、高速通信環境下でのデータ着信時にスケルトンが一瞬だけ点滅する不快現象（Visual Flash）を防ぐ**意図的なUX保護機能**である。これを「画面の読み込みを遅らせているバグ」「チラつきの原因」と誤解し、タイマーを短縮・削除・バイパスする変更や指摘を行うことを**厳重に禁止する**。

---

## 4. 状態管理とデータフローの絶対ルール
- **Server State vs UI State:** 
  - データベースの永続データは TanStack Query (`useQuery` / `useMutation`) で管理し、更新時は必ず `invalidateQueries` または `setQueriesData` で手元キャッシュを一括分配すること。
  - Zustand はローカルのUI状態（選択ID、未保存フラグ等）のみを管理し、DBデータを手動で配列同期してはならない。
- **URL Params as SSOT:** 階層移動、ドリルダウン、詳細表示などのコンテキスト状態は `URLSearchParams` を唯一の情報源（SSOT）とすること。ただし、ミリ秒単位のパネル開閉やアニメーションフラグまで URL に同期させて描画パフォーマンスを破壊してはならない。
- **In-Memory First Pattern:** 親データ（ドラフト等）が未保存の状態で子データ（メモ等）を作成する際、裏側で勝手に親を自動保存してはならない（ゴーストデータの防止）。
