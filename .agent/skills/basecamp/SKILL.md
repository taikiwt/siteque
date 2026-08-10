---
trigger: always_on
description: CodeMirrorエディタ、Markdown、未保存データガード、およびUIコンポーネント実装の専門ルール
---

# App Basecamp Editor & Component Rules

※最優先遵守事項については必ず `.agent/rules/core-rules.md` を参照すること。

## 1. エディタ（Markdown）の実装方針
- **WYSIWYG 禁止 ＆ CodeMirror 採用**: BlockベースWYSIWYGは不採用。CodeMirror (`@uiw/react-codemirror`) による「Markdown記号維持＋控えめなシンタックスハイライト」を標準とする。
- **CodeMirror 設定のメモ化必須化 (prevent CPU Spikes)**:
  - `extensions` プロパティへインライン配列 (`[...]`) やメモ化されていないオブジェクトを直接渡すことは **絶対禁止**。
  - 再初期化ループによる CPU 100% 消費を防ぐため、拡張設定は必ず `const extensions = useMemo(() => [...], [])` でメモ化すること。
  - 文字数制限等の制御はエディタ内部に組み込まず、親コンポーネント (React State) 側で分離監視すること。
- **Markdown レンダリング**: 保存後・閲覧時は Tailwind Typography (`@tailwindcss/typography`) の `prose` クラスを用いて描画すること。

## 2. 未保存データの保護とルーティング
- **グローバル状態管理**: 未保存変更（`isDirty`）は Zustand (`useEditorStore`) で管理すること。
- **`<CustomLink>` の使用徹底**: アプリ内遷移には `next/link` を使わず、離脱警告ダイアログを持つ `<CustomLink>` (`@/components/ui/custom-link`) を使用すること。ボタン風要素であっても `router.push()` を安易に使わず `<CustomLink>` に Tailwind クラスを当てて装飾すること。
- **Save 後のステート同期**: 保存完了後は `savedState` を最新値で上書きし、`isDirty` 判定の比較ベースを安全に更新すること。

## 3. Base UI Component Rules
- **Popover**: `@base-ui/react` の Popover は、必ず `<Popover.Popup>` を `<Popover.Positioner>` でラップし、Positioner 側に明示的に `className="z-50"` を設定して見切れを防ぐこと。
- **Dialog/Modal 多重起動の禁止**: ダイアログ開去中に別モーダルをトリガーする場合は、必ず現在のモーダルを完全に閉じてから次のモーダルを開く順序を保証すること（フォーカストラップ衝突防止）。
- **Portal 機能の利用**: 狭いコンテナ（Rail UI等）内のメニューは、必ず Portal 機能を持つコンポーネントを用いて最前面描画させること。
