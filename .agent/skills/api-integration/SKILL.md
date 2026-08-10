---
trigger: always_on
description: Hono API、プロンプト分離、モデル管理、およびレイヤー構造の専門ルール
---

# API & AI Prompt Integration Rules

※最優先遵守事項については必ず `.agent/rules/core-rules.md` を参照すること。

## 1. Hono API レイヤーアーキテクチャ (`apps/api/`)
- **`index.ts`**: アプリ初期化とルートマウントのみ行う「薄い層」。
- **`routes/`**: リクエストの受け取り・レスポンス返却のみ。ビジネスロジックは `services/` へ委譲。
- **`services/`**: AIモデル呼び出し、クオータ管理、DB操作等の純粋ロジック。`Context` に直接依存させないこと。

## 2. プロンプト管理と型安全の掟
- **プロンプトの物理的分離**: バックエンドでのプロンプト組み立て長文は、`services/` 内にベタ書きせず、必ず `apps/api/src/prompts/` ディレクトリ配下に純粋関数として切り出すこと。
- **Supabase 型アサーションの明記**: API層で Supabase から値を取得する際は、暗黙の `any` を防ぐため、必ず明示的な型アサーション（例: `rawData as { weave_prompt: string | null }`）を行うこと。

## 3. AI モデル管理と環境変数
- **モデルIDのハードコード禁止**: Gemini 等のモデル名ストリング（例: `gemini-1.5-flash`）を `.ts` ファイル内に直接記述してはならない。必ず環境変数（`c.env.GEMINI_MODEL_NAME` 等）から注入し、未設定時のフォールバックとしてのみ正確なデフォルト値を記述すること。
