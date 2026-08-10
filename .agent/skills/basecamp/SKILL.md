# App Basecamp (Next.js) Implementation Rules

sitecueの活動拠点となるApp Basecamp（`apps/app/`）側の実装において、AIエディタが遵守すべきUI/UXおよびNext.js固有の実装ルールを定義する。

## エディタ（Markdown）の実装方針
1. **WYSIWYGの禁止とCodeMirrorの採用:**
   NotionライクなブロックベースのWYSIWYGエディタ（TipTap等）は、DOMの肥大化や入力コントロールの喪失（意図しない自動変換）を招くため採用しない。
   エディタエンジンには拡張性とパフォーマンスに優れた **CodeMirror** (`@uiw/react-codemirror`) を採用し、「Markdown記号を維持したままの控えめなシンタックスハイライト（1ペイン）」を基本UXとする。
   - **Implementation Priority**: 抽象的なデザイン理念と、堅牢で業界標準（Industry-standard）な実装手法が競合した場合は、**常に「堅牢で業界標準な実装」を優先**する。見た目のシンプルさのためにアクセシビリティ（a11y）やセマンティックなHTMLを犠牲にしてはならない。
   - **Layout Stability & Non-destructive Styling**:
     - コンポーネントの置き換えやアニメーションの導入時、既存の `className` を不用意に削除したり、パディング・マージンを変更してレイアウトシフト（要素のがたつき）を発生させてはならない。
     - `InlineCopyButton` 等を導入する際は、元のボタンが持っていたサイズ感や余白を `className` で補完し、視覚的な一貫性を維持すること。

2. **Markdownのレンダリング（表示モード）:**
   保存後やプレビューなどの閲覧用画面では、Tailwind CSS v4 の公式プラグインである **Tailwind Typography (`@tailwindcss/typography`)** を使用し、親要素に `className="prose"` を付与することで美しくスタイリングすること。
3. **CodeMirror設定のメモ化必須化 (Prevent Infinite Loops & CPU Spikes):**
   - `@uiw/react-codemirror` コンポーネントに渡す `extensions` プロパティに対し、インラインの配列（`[...]`）やメモ化されていないオブジェクトを直接渡すことは **絶対禁止** とする。
   - レンダリングのたびに新しい配列が生成されると、CodeMirrorが再初期化を繰り返し、`onChange` が暴発してブラウザとサーバーのCPUを100%まで消費する無限ループ（致命的なDDoS状態）を引き起こす。
   - ショートカット（`keymap.of`）などの動的な拡張を追加する際は、必ず `const extensions = useMemo(() => [...], [])` のようにメモ化し、依存配列を正しく管理すること。
   - **文字数制限などのUI制御の分離**: エディタは純粋な「テキストの入出力」に専念させることが望ましい。文字数超過による入力制限やボタンの無効化などは、エディタ本体（`extensions` 内部）に動的なロジックとして仕込むのではなく、親コンポーネント（React State）側で監視・制御を行う設計（引き算の美学）をベストプラクティスとする。

## 未保存データの保護とルーティング（App Router）
Next.js App Router 環境では、クライアントサイドルーティング時にブラウザ標準の `beforeunload` が発火しないため、以下の独自ルールでデータ消失を防ぐこと。

1. **グローバルステートによる状態管理:**
   エディタ等の入力画面で未保存の変更（`isDirty`）が発生した場合、その状態はコンポーネント内に閉じず、必ず Zustand (`useEditorStore`) を用いてグローバルに同期すること。
2. **`<CustomLink>` の使用と `router.push()` の制限（未保存ガードの徹底）:**
   アプリ内遷移には `next/link` を直接使わず、必ず `useEditorStore` を監視して離脱警告ダイアログ（confirm）を出すラッパーコンポーネント **`<CustomLink>`** (`@/components/ui/custom-link`) を使用すること。Launchpad（ダッシュボードポータル）内のナビゲーションリンクにおいても、未保存ガードを機能させるため例外なく `<CustomLink>` の使用を徹底する。
   **【🚨過去のバグ教訓】** 「戻る」ボタンなどを実装する際、`<Button onClick={() => router.push('/')}>` のように Next.js の `useRouter` を用いて直接遷移させると、この未保存ガードを完全にすり抜けてしまう致命的な不具合が発生した。そのため、ボタンの見た目が必要な場合でも、必ず `<CustomLink href="...">` に対して Tailwind クラス（`buttonVariants` など）を当てて実装し、ユーザーのクリックによる画面遷移で `router.push()` を安易に使用しないこと。
3. **Save後のステート同期バグの回避:**
   保存処理（Save）後に `isDirty` が true のままになるバグを防ぐため、`isDirty` の判定において「ページロード時の初期データ（`initialDraft` 等）」を直接比較対象としないこと。必ずコンポーネント内で `savedState`（最後に保存した状態）を定義し、DB保存成功直後にそのステートを最新値で上書きして比較のベースとすること。

## Base UI Component Rules
- **Popover**: `@base-ui/react` の Popover を使用・実装する際は、必ず `<Popover.Popup>` を `<Popover.Positioner>` でラップすること。これを忘れると `PopoverPositionerContext is missing` のクラッシュエラーが発生するため厳守すること。
- **Floating UIのスタッキングコンテキスト (Explicit z-index for Positioners)**:
  - `@base-ui/react` (または Radix UI) の Popover 等を使用する際、トリガー要素が `sticky` や `fixed` などのスタッキングコンテキストを持つ親要素（例: `z-10` のヘッダー）の内部にある場合、ポップオーバーが親要素の下に隠れてしまう（見切れる）問題が発生する。
  - `<Popover.Popup>` (または `PopoverContent`) 自体に `z-50` を設定するだけでは不十分である。必ずその親となる `<Popover.Positioner>` (または `FloatingPortal` 内のラッパー) に対して明示的に `className="z-50"` 等の z-index を付与し、フローティング要素全体を正しいレイヤーに引き上げること。
- **Dialog/Modalの多重起動（フォーカストラップの衝突回避）**:
  - `Dialog` や `AlertDialog` 等のモーダル要素（shadcn/Radix UI）を開いている状態から、さらに別のグローバルなモーダル（例: エラー表示用の `PaywallModal` など）をトリガーする場合、そのまま新しいモーダルの状態を `true` にするとフォーカストラップやイベントリスナーが衝突しUIがフリーズする。
  - **絶対ルール**: 新しいモーダルを呼び出す（ステートを更新する）直前に、必ず現在開いているダイアログの `onOpenChange(false)` やキャンセル処理を実行し、**「現在のモーダルを完全に閉じてから、次のモーダルを開く」** という順序を保証すること。
- **Narrow Container Constraints (Rail UI等での見切れ防止)**:
  - `w-16` のような幅の狭いコンテナや、`overflow-hidden` が適用された親要素の内部でドロップダウンやメニューを展開する場合、単純な `absolute` 配置では表示領域が見切れて（クリッピングされて）しまう。
  - **絶対ルール**: UserMenuやアクションメニューなどを実装する際は、必ず `@/components/ui/popover` や `Dialog` などの **Portal機能を持つフローティングコンポーネント** を使用し、親要素のDOM階層から抜け出して最前面（`z-50` 以上）に描画されるよう徹底すること。
- **Hydration Mismatchの防止 (Stable ID Injection)**:
  - `@base-ui/react` や Shadcn のコンポーネント（特に Popover, Dialog などのアクセシビリティ要素）を Server/Client を跨いでレンダリングする際、自動生成される ID によって Hydration Mismatch が発生した場合は、`React.useId()` を用いて生成した安定した ID を `id` プロパティとして明示的に渡す堅牢な実装を第一選択とすること。安易に `suppressHydrationWarning` やクライアントマウントへの逃げを行わないこと。

## AppShellアーキテクチャにおける高さ（Height）の管理
1. **二重スクロールの禁止**:
   - 画面全体をスクロールさせるのではなく、サイドバーやメインコンテンツ領域などの各パネルが独立して高さを持ち、個別にスクロールする「AppShell」形式を基本とする。
   - 親要素に `h-full overflow-hidden` を適用してブラウザ標準のスクロールをロックし、スクロールさせたい子要素（Content Area等）に `flex-1 overflow-y-auto` を適用すること。
2. **ヘッダー/アクションバーの固定化**:
   - 詳細ペインやリストペインにおいて、操作ボタン（Save, Edit等）が含まれるヘッダー部分は、コンテンツのスクロールに関わらず常に上部に固定されている必要がある。
   - `flex flex-col` の構造を用い、ヘッダーに `shrink-0`、コンテンツに `flex-1 overflow-y-auto` を指定することで、CSSの `sticky` に頼らず物理的にスクロール領域を分離する実装を推奨する。

## Component Responsibility & State Purging
1. **クリップボード操作の状態管理のカプセル化**:
   - `navigator.clipboard` を用いたコピー操作において、「コピー完了後のアイコン変化（タイマー）」などのUI状態を、利用側の親コンポーネントで個別に管理（`useState`）することは避ける。
   - 原則として `InlineCopyButton` 等のカプセル化されたコンポーネントを使用し、親コンポーネントのステートをパージ（引き算）することで、保守性とDRY原則を徹底する。

## Service Worker (SW) サードパーティ通信エラーハンドリング
Service Worker (`public/sw.js`) 内の `fetch` イベント処理において、外部アナリティクスやサードパーティドメインへの通信失敗（`net::ERR_BLOCKED_BY_CLIENT` 等）時に `TypeError: Failed to convert value to 'Response'` でレスポンス生成を破綻させないよう、例外を `try-catch` で安全に捕獲してフォールバック通過（または無効化）させる処理を必須とする。

## `sw.js` におけるドキュメントナビゲーションおよび RSC 通信の Bypass 規約
`public/sw.js` において、`mode === "navigate"` または `text/html` 要求（画面全体の取得）、および `_rsc` パラメータを持つ Next.js 画面更新リクエストを SW ハンドラ冒頭で無条件に即座 `return;` させること。ドキュメント通信を SW のキャッシュ処理から完全に切り離し、100% サーバー（`middleware.ts`）へ直通させて認証リダイレクトを保証すること。