---
trigger: always_on
description: 楽観的UI、SWRBoundary仕様、UX、状態管理、コンポーネント実装のReact規約
---

# React & UI Implementation Rules

※最優先遵守事項（SWRBoundary×Suspense二重防壁、200msスケルトン保持等の絶対禁止事項）については必ず `.agent/rules/core-rules.md` を参照すること。

## 1. Core Async Display Infrastructure: SWRBoundary Rules
- **表示ライフサイクル**:
  1. **Unblocked Shell**: UIシェルはデータ取得状態に関わらず 0ms 常時表示。
  2. **Cold Start (200ms ホールド)**: 初回アクセス時はスケルトンを表示。チラつき防止のため最低 200ms (`SKELETON_HOLD_MS`) 表示を維持する（データ空確定時は 0ms スキップ可）。
  3. **Warm State (0ms 即時表示)**: キャッシュ保持時は 0ms で即座にデータ表示。重い処理を伴う場合は `useDeferredValue` と `isDataReady` プロップを連動させる。
- **基盤進化の原則**: 未知の表示条件が必要な場合は、コンポーネント側でローディングタイマーを書かず、必ず `swr-boundary.tsx` 自体を拡張して使用すること。

## 2. 状態管理の責務分離 (Server State vs UI State)
- **Server State = TanStack Query**: 永続データ（Notes, Drafts等）の管理。変更時は `onSuccess` 内で `setQueriesData`（手元キャッシュ一括更新）と `invalidateQueries`（バックグラウンド再検証）を必ずセットで実行すること。
- **UI State = Zustand**: 純粋なブラウザ上のUI状態（選択ID、未保存フラグ `isDirty` 等）のみを管理する。DBデータ配列を手動管理・同期してはならない。
- **URL Params as SSOT**: 画面リロード時も維持すべき永続コンテキスト（タブ、表示ノートID等）は `URLSearchParams` を唯一の情報源とする。ただし、パネル開閉やアニメーション等のミリ秒単位のフラグは URL に同期させず Client State に留めること。

## 3. UX, Form & Interactive Rules
- **IME Composing Guard**: Enterキーでの追加・送信インタラクションを行う箇所では、漢字変換確定時のEnter暴発を防ぐため、必ず `if (e.nativeEvent.isComposing) return;` ガードを先頭に記述すること。
- **Icons & Tooltips**: `lucide-react` のアイコンに直接 `title` 属性を渡さず、ラッパー要素（`<span>`, `<button>`）に `title` または `aria-label` を付与すること。
- **iOS Safari 自動ズーム防止**: 入力フォーム (`<input>`, `<textarea>`) のフォントサイズは 16px 以上（`text-base md:text-sm`）に設定すること。
- **非同期アクションの二重ロック**: API通信を伴う処理は、UI側の `disabled` に加え、ハンドラー関数の先頭にソフトウェアロック（`if (isLoading) return;`）を配置して二重防御すること。

## 4. Responsive Design & Layout Systems
- **Responsive Layout Wrapper パターン**: PCとモバイルで大きく構造が変わるUIは、1コンポーネント内でクラス分岐させず、`useMediaQuery` を用いて「PC用」と「モバイル用」のコンポーネントを物理分離すること。二重描画を防ぐため、最外殻コンテナには静的ブレークポイントクラス（`hidden lg:flex`, `lg:hidden`）を併用すること。
- **Mobile Drill-down (Stack over Drawer)**: モバイルの詳細遷移は、iOSスワイプバックと干渉する `Drawer` ではなく、CSS `transform-gpu` による右からのスライドイン（Stack遷移）を採用すること。
- **長大文字列の Grid ガード**: ドメイン名やURLを横並びで表示する領域は `grid grid-cols-[minmax(0,1fr)_auto]` で囲み、省略（`truncate`）される要素にはネイティブの `title` 属性を必ず設定すること。

## 5. Optimistic UI & Drag and Drop (@dnd-kit)
- **楽観的UIのロック**: 並び替え等の処理中はステートで操作をロック（`disabled`）し、ロールバックの無限ループを防ぐこと。
- **D&Dルールの徹底**: `useSortable` は1アイテムにつき1回のみ呼び出し。ドラッグハンドルには `style={{ touchAction: "none" }}` を付与。`<DndContext>` には SSR の Hydration Error 防止のため固定 ID（例: `id="notes-dnd-context"`）を渡すこと。
