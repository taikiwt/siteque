import type { Diary } from "@sitecue/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DiaryStudioClient } from "./DiaryStudioClient";

// useRouter等のモック化
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
}));

// Supabaseクライアントのモック
vi.mock("@/utils/supabase/client", () => ({
	createClient: () => ({
		auth: {
			getUser: vi.fn().mockResolvedValue({
				data: { user: { id: "u1" } },
			}),
		},
	}),
}));

// shared DAL のモック
vi.mock("@sitecue/shared", async () => {
	const actual = await vi.importActual("@sitecue/shared");
	return {
		...actual,
		updateDiaryContent: vi
			.fn()
			.mockImplementation(async (_sp, _uid, date, text, topics) => ({
				user_id: "u1",
				date,
				content: text,
				topics: topics || [],
				created_at: "2026-06-28T00:00:00Z",
				updated_at: new Date().toISOString(),
			})),
	};
});

// useMediaQuery のモック化 (デスクトップ表示をシミュレート)
vi.mock("@/hooks/use-media-query", () => ({
	useMediaQuery: () => true,
}));

// CodeMirrorがテスト環境でクラッシュするのを防ぐ簡易モック
vi.mock("@/components/editor/StudioEditor", () => ({
	StudioEditor: ({
		value,
		onChange,
	}: {
		value: string;
		onChange: (v: string) => void;
	}) =>
		React.createElement("textarea", {
			"data-testid": "mock-editor",
			value,
			onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
				onChange(e.target.value),
		}),
}));

vi.mock("./DiaryMaterialsPane", () => ({
	DiaryMaterialsPane: ({
		onInsert,
	}: {
		onInsert?: (content: string) => void;
	}) =>
		React.createElement(
			"button",
			{
				type: "button",
				"data-testid": "mock-insert-btn",
				onClick: () => onInsert?.("Inserted Text"),
			},
			"Insert",
		),
}));

describe("DiaryStudioClient", () => {
	const createTestQueryClient = () =>
		new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		});

	const setup = (
		initialDiary: Parameters<typeof DiaryStudioClient>[0]["initialDiary"],
	) => {
		const queryClient = createTestQueryClient();
		return render(
			React.createElement(
				QueryClientProvider,
				{ client: queryClient },
				React.createElement(DiaryStudioClient, {
					initialDiary,
					date: "2026-06-28",
				}),
			),
		);
	};

	it("初期状態（変更なし）ではSaveボタンが非活性であること", () => {
		setup({
			user_id: "u1",
			date: "2026-06-28",
			content: "Original Content",
			topics: [],
			created_at: "",
			updated_at: "",
		});
		const saveBtn = screen.getAllByRole("button", { name: /Save Diary/i })[0];
		expect(saveBtn).toBeDisabled();
	});

	it("エディタの内容が変更されたらSaveボタンが活性化すること", async () => {
		setup({
			user_id: "u1",
			date: "2026-06-28",
			content: "Original Content",
			topics: [],
			created_at: "",
			updated_at: "",
		});
		const editor = screen.getAllByTestId("mock-editor")[0];
		fireEvent.change(editor, { target: { value: "Modified Content" } });
		const saveBtn = screen.getAllByRole("button", { name: /Save Diary/i })[0];
		expect(saveBtn).not.toBeDisabled();
	});

	it("文字数が制限（Free: 50,000字）を超えた場合、Saveボタンが非活性化すること", () => {
		setup({
			user_id: "u1",
			date: "2026-06-28",
			content: "Original Content",
			topics: [],
			created_at: "",
			updated_at: "",
		});
		const editor = screen.getAllByTestId("mock-editor")[0];
		const overLimitText = "a".repeat(50001);
		fireEvent.change(editor, { target: { value: overLimitText } });
		const saveBtn = screen.getAllByRole("button", { name: /Save Diary/i })[0];
		expect(saveBtn).toBeDisabled();
	});

	it("素材のインサートボタンを押した際にエディタの末尾にテキストが追記結合されること", () => {
		setup({
			user_id: "u1",
			date: "2026-06-28",
			content: "Original",
			topics: [],
			created_at: "",
			updated_at: "",
		});
		const insertBtns = screen.getAllByTestId("mock-insert-btn");
		fireEvent.click(insertBtns[0]);
		const editor = screen.getAllByTestId(
			"mock-editor",
		)[0] as HTMLTextAreaElement;
		expect(editor.value).toBe("Original\n\nInserted Text");
	});
});

describe("DiaryStudioClient - キャッシュ型不整合修復検証", () => {
	it("配列キャッシュと詳細オブジェクトキャッシュが混在する状態で保存した際、e.some is not a function エラーを出さずにキャッシュが同期されること", async () => {
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		});

		const initialList: Diary[] = [
			{
				user_id: "u1",
				date: "2026-06-28",
				content: "Initial Content",
				topics: [],
				created_at: "",
				updated_at: "",
			},
		];

		const initialDetail: Diary = {
			user_id: "u1",
			date: "2026-06-28",
			content: "Initial Content",
			topics: [],
			created_at: "",
			updated_at: "",
		};

		// 意図的に一覧キャッシュ (Array) と 詳細キャッシュ (Object) の双方をキャッシュにセット
		queryClient.setQueryData(["diaries"], initialList);
		queryClient.setQueryData(["diaries", "2026-06-28"], initialDetail);

		render(
			React.createElement(
				QueryClientProvider,
				{ client: queryClient },
				React.createElement(DiaryStudioClient, {
					initialDiary: initialDetail,
					date: "2026-06-28",
				}),
			),
		);

		const editor = screen.getAllByTestId("mock-editor")[0];
		fireEvent.change(editor, {
			target: { value: "Updated Content Second Save" },
		});

		const saveBtn = screen.getAllByRole("button", { name: /Save Diary/i })[0];
		expect(saveBtn).not.toBeDisabled();

		// 保存ボタンクリック
		await act(async () => {
			fireEvent.click(saveBtn);
		});

		// Saved ステータスへ正常遷移すること（エラーが出ないこと）を検証
		await waitFor(() => {
			expect(
				screen.getAllByRole("button", { name: /Saved/i })[0],
			).toBeInTheDocument();
		});

		// キャッシュが正しく更新されているか検証
		const updatedDetail = queryClient.getQueryData<Diary>([
			"diaries",
			"2026-06-28",
		]);
		expect(updatedDetail?.content).toBe("Updated Content Second Save");

		const updatedList = queryClient.getQueryData<Diary[]>(["diaries"]);
		expect(updatedList?.[0]?.content).toBe("Updated Content Second Save");
	});
});

describe("DiaryStudioClient - Local Suspense Shell Protection", () => {
	it("ローディング状態でもヘッダーとシェルUIが崩れずに描画されること", () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		render(
			<QueryClientProvider client={queryClient}>
				<DiaryStudioClient date="2026-06-28" initialDiary={null} />
			</QueryClientProvider>,
		);

		expect(screen.getAllByText("Diary Studio")[0]).toBeInTheDocument();
		expect(screen.getAllByText("2026-06-28")[0]).toBeInTheDocument();
	});
});
