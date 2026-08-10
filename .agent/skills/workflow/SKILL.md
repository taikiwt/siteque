---
trigger: always_on
description: 開発ガイドライン、コンポーネント細分化、Git運用、およびUX・キャッシュ同期の専門ルール
---

# Workflow Rules

※最優先遵守事項（Bunの使用、DAL強制、Biome、Impact Analysis等）については必ず `.agent/rules/core-rules.md` を参照すること。

## 1. Release & Git Workflow
- **シンプル GitHub Flow**: `main` ブランチを本番最新とし、機能開発・バグ修正は `feat/*` または `fix/*` ブランチで行う。
- **バージョンタグ管理**: Chromeストア審査提出時に `main` ブランチのコミットにバージョンタグ（例: `v1.0.1`）を付与すること。

## 2. Component & Logic Segmentation (細分化基準)
- **150行ルール**: 1ファイルが150行を超え始めたら、コンポーネント分割またはカスタムフック (`hooks/useXXX.ts`) への抽出を行うこと。
- **コンテナとプレゼンテーションの分離**: ページルートはフックから状態を受け取り、切り出した UI コンポーネントへ Props 渡す「薄いコンテナ」に徹すること。
- **`NoteItem` の再描画最適化**: 計算コストの高い表示要素は独立した `React.memo` へ分離し、`arePropsEqual` で厳格比較すること。イベントハンドラはすべて `useCallback` で参照固定すること。

## 3. UX, Optimistic Updates & Cache Synchronization
- **サイレント・リフェッチ (Silent Refetching)**: バックグラウンドでのデータ再取得時、既にデータが表示されている場合は全体ローディングスピナーを出さず、入力フォーカスと状態を保持すること。
- **TanStack Query キャッシュのインメモリ再整列 (`.sort()`)**: D&D 等で `sort_order` を更新して手元キャッシュ (`setQueriesData`) を差し替えた直後、**必ず DB と同一の公式ソート規約に基づき配列全体を `.sort()` で再整列させてから確定させること**（スナップバック防止）。
- **非同期ミューテーションと RSC 同期の直列化**: `router.refresh()` を呼び出す前に、必ず `mutateAsync` を用いて通信と手元キャッシュ分配の完了を `await` で待機すること。
- **Concurrent Rendering 検索反映**: 検索窓の文字入力（`searchQuery`）は 0ms 最優先とし、リストフィルタリング計算には `useDeferredValue(searchQuery)` を適用して入力遅延を防ぐこと。
