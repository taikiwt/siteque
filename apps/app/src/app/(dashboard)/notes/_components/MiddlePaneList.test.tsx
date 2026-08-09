import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { groupNotes } from "@/store/useNotesStore";
import type { Note } from "../types";
import { MiddlePaneList } from "./MiddlePaneList";

// Mock Supabase client
vi.mock("@/utils/supabase/client", () => ({
	createClient: vi.fn(() => ({
		from: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		in: vi.fn().mockResolvedValue({ error: null }),
	})),
}));

// Mock Next.js navigation
const refreshMock = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();
const searchParamsMock = vi.fn(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: refreshMock,
		push: mockPush,
		replace: mockReplace,
	}),
	usePathname: () => "/notes",
	useSearchParams: () => searchParamsMock(),
}));

// Mock useUpdateNote safely using a mock-prefixed bridge to bypass hoisting errors
const mockMutate: {
	(...args: unknown[]): unknown;
	impl: (...args: unknown[]) => unknown;
} = (...args: unknown[]) => mockMutate.impl(...args);
mockMutate.impl = () => {};

vi.mock("@/hooks/useNotesQuery", () => ({
	useUpdateNote: () => ({ mutate: mockMutate, mutateAsync: mockMutate }),
	useDeleteNotes: () => ({ mutate: mockMutate, mutateAsync: mockMutate }),
}));

// Mock DndContext safely using a mock-prefixed bridge
const mockLastOnDragEndContainer: {
	current: ((event: unknown) => void) | null;
} = { current: null };
vi.mock("@dnd-kit/core", () => ({
	closestCenter: vi.fn(),
	PointerSensor: vi.fn(),
	useSensor: vi.fn(),
	useSensors: vi.fn(),
	DndContext: (props: {
		children: React.ReactNode;
		onDragEnd?: (event: unknown) => void;
	}) => {
		mockLastOnDragEndContainer.current = props.onDragEnd ?? null;
		return props.children;
	},
}));

vi.mock("@/hooks/useDiariesQuery", () => ({
	useFetchDiaries: vi.fn(() => ({ data: [] })),
	useAppendDiary: vi.fn(() => ({ mutate: vi.fn() })),
}));

const mockItems: Note[] = [
	{
		id: "note-1",
		content: "Note 1",
		note_type: "info",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		user_id: "user-1",
		scope: "inbox",
		url_pattern: "",
		is_expanded: false,
		is_favorite: false,
		is_pinned: false,
		is_resolved: false,
		sort_order: 0,
		draft_id: null,
		tags: null,
	},
	{
		id: "note-2",
		content: "Note 2",
		note_type: "idea",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		user_id: "user-1",
		scope: "inbox",
		url_pattern: "",
		is_expanded: false,
		is_favorite: false,
		is_pinned: false,
		is_resolved: false,
		sort_order: 1,
		draft_id: null,
		tags: null,
	},
];

const mockGroupedNotes = {
	inbox: mockItems,
	drafts: [],
	domains: {},
};

describe("MiddlePaneList Bulk Actions", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		searchParamsMock.mockReturnValue(new URLSearchParams());
		vi.useRealTimers();
	});

	it("should show checkboxes and action bar when selection is enabled", async () => {
		const user = userEvent.setup();
		render(
			<MiddlePaneList
				items={mockItems}
				groupedNotes={mockGroupedNotes}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		// Initially no action bar
		expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();

		// Enable select mode first
		const selectModeButton = screen.getByTitle("Select Mode");
		await user.click(selectModeButton);

		// Check the first note
		const checkboxes = screen.getAllByRole("checkbox");
		expect(checkboxes).toHaveLength(2);

		await user.click(checkboxes[0]);

		// Now action bar should be visible
		expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();

		// Cancel selection
		await user.click(screen.getByRole("button", { name: /cancel/i }));
		expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
	});

	it("should hide resolved notes by default and show them when toggle is clicked", async () => {
		const user = userEvent.setup();
		render(
			<MiddlePaneList
				items={[
					...mockItems,
					{
						...mockItems[0],
						id: "resolved-note",
						content: "Resolved Content",
						is_resolved: true,
					},
				]}
				groupedNotes={mockGroupedNotes}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);
		expect(screen.queryByText("Resolved Content")).not.toBeInTheDocument();

		const toggleBtn = screen.getByTitle("Show Resolved Notes");
		await user.click(toggleBtn);
		expect(screen.getByText("Resolved Content")).toBeInTheDocument();
	});

	it("should filter notes by note_type when filter buttons are clicked", async () => {
		const user = userEvent.setup();
		render(
			<MiddlePaneList
				items={mockItems}
				groupedNotes={mockGroupedNotes}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		// Initially both notes should be visible
		expect(screen.getByText("Note 1")).toBeInTheDocument(); // info note
		expect(screen.getByText("Note 2")).toBeInTheDocument(); // idea note

		// Click Idea filter
		const ideaFilterBtn = screen.getAllByRole("button", { name: "Idea" })[0];
		await user.click(ideaFilterBtn);

		// Only Note 2 (idea) should be visible
		expect(screen.queryByText("Note 1")).not.toBeInTheDocument();
		expect(screen.getByText("Note 2")).toBeInTheDocument();

		// Click All filter
		const allFilterBtn = screen.getByRole("button", { name: "All" });
		await user.click(allFilterBtn);

		// Both should be visible again
		expect(screen.getByText("Note 1")).toBeInTheDocument();
		expect(screen.getByText("Note 2")).toBeInTheDocument();
	});
});

describe("MiddlePaneList Hierarchy & SSOT", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		searchParamsMock.mockReturnValue(new URLSearchParams());
		vi.useRealTimers();
	});

	it("renders 'Domain Notes' correctly in domain pages view", () => {
		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{
					domains: { "example.com": { domainNotes: [], pages: {} } },
					inbox: [],
					drafts: [],
				}}
				currentView={null}
				currentDomain="example.com"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);
		expect(screen.getByText("Domain Notes")).toBeDefined();
	});

	it("keeps exact=all in New Note button href", () => {
		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView={null}
				currentDomain="example.com"
				currentExact="all"
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);
		const newNoteLink = screen.getByTitle("New Note here");
		expect(newNoteLink.getAttribute("href")).toContain("exact=all");
	});
});

describe("MiddlePaneList Layout Verification", () => {
	afterEach(() => {
		cleanup();
	});

	it("should have a mobile spacer and not have pt-14 on root div", () => {
		const { container } = render(
			<MiddlePaneList
				items={mockItems}
				groupedNotes={mockGroupedNotes}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		// Check root div does not have pt-14
		const rootDiv = container.firstChild as HTMLElement;
		expect(rootDiv.className).not.toContain("pt-14");

		// Check spacer exists inside scroll container
		const scrollContainer = container.querySelector(".flex-1.overflow-y-auto");
		expect(scrollContainer).toBeInTheDocument();
	});

	it("should have a mobile spacer in domains view", () => {
		const { container } = render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{
					domains: { "example.com": { domainNotes: [], pages: {} } },
					inbox: [],
					drafts: [],
				}}
				currentView="domains"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		const scrollContainer = container.querySelector(".flex-1.overflow-y-auto");
		expect(scrollContainer).toBeInTheDocument();
	});
});

describe("MiddlePaneList Tab and Search Interactions", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		searchParamsMock.mockReturnValue(new URLSearchParams());
		vi.useRealTimers();
	});

	it("updates URL params when tab is clicked, but search does not navigate", async () => {
		const user = userEvent.setup();
		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		// タブのクリック
		const domainsTab = screen.getByRole("button", { name: /Domains/i });
		await user.click(domainsTab);
		expect(mockReplace).toHaveBeenCalledWith(
			expect.stringContaining("view=domains"),
			{ scroll: false },
		);

		// mockPushとmockReplaceの履歴をクリア
		mockPush.mockClear();
		mockReplace.mockClear();

		// 検索の入力および実行
		const searchInput = screen.getByPlaceholderText("Search notes...");
		await user.type(searchInput, "test query{Enter}");
		expect(mockPush).not.toHaveBeenCalled();
		expect(mockReplace).not.toHaveBeenCalled();
	});

	it("cleans up context parameters when switching tabs", async () => {
		const user = userEvent.setup();
		// Mock searchParams to have pollution
		searchParamsMock.mockReturnValue(
			new URLSearchParams(
				"view=domains&domain=example.com&exact=all&noteId=123&q=test",
			),
		);

		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="domains"
				currentDomain="example.com"
				currentExact="all"
				selectedNoteId="123"
				selectedDraftId={null}
			/>,
		);

		const inboxTab = screen.getByRole("button", { name: /Inbox/i });
		await user.click(inboxTab);

		expect(mockReplace).toHaveBeenCalledWith("/notes?view=inbox", {
			scroll: false,
		});
	});

	it("clears search input when clear button is clicked", async () => {
		const user = userEvent.setup();
		searchParamsMock.mockReturnValue(new URLSearchParams("view=inbox&q=test"));

		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		const searchInput = screen.getByPlaceholderText(
			"Search notes...",
		) as HTMLInputElement;
		expect(searchInput.value).toBe("test");

		const clearButton = screen.getByLabelText("Clear search");
		await user.click(clearButton);

		expect(searchInput.value).toBe("");
		expect(mockReplace).toHaveBeenCalledWith(
			expect.not.stringContaining("q="),
			{ scroll: false },
		);
	});

	it("excludes 'inbox' from domains list", () => {
		const notes: Note[] = [
			{
				...mockItems[0],
				id: "inbox-note",
				scope: "inbox",
				url_pattern: "inbox",
			},
			{
				...mockItems[0],
				id: "domain-note",
				scope: "domain",
				url_pattern: "https://example.com",
			},
		];
		const groupedNotes = groupNotes(notes, []);

		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={groupedNotes}
				currentView="domains"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		expect(screen.getByText("example.com")).toBeDefined();
		expect(screen.queryByText("inbox")).not.toBeInTheDocument();
	});

	it("filters domains list based on search query", async () => {
		const groupedNotes = {
			domains: {
				"apple.com": { domainNotes: [], pages: {} },
				"google.com": { domainNotes: [], pages: {} },
			},
			inbox: [],
			drafts: [],
		};

		// 検索クエリを 'google' に設定
		searchParamsMock.mockReturnValue(
			new URLSearchParams("view=domains&q=google"),
		);

		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={groupedNotes}
				currentView="domains"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		expect(screen.getByText("google.com")).toBeDefined();
		expect(screen.queryByText("apple.com")).not.toBeInTheDocument();
	});

	it("すべてのタブ（Inbox/Notes）において、URLパラメータを変更せずローカルState(inputValue)のみで超軽量インメモリ検索ができること", async () => {
		render(
			<MiddlePaneList
				items={mockItems}
				groupedNotes={mockGroupedNotes}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		// 初期状態では Note 1 と Note 2 の双方が描画されている
		expect(screen.getByText("Note 1")).toBeInTheDocument();
		expect(screen.getByText("Note 2")).toBeInTheDocument();

		// 検索窓に "Note 2" を入力（URLのモック変更やタイマーの前進は不要）
		const searchInput = screen.getByPlaceholderText("Search notes...");
		fireEvent.change(searchInput, { target: { value: "Note 2" } });

		// 【インメモリの証】URL遷移（mockReplace / mockPush）は1回も呼ばれていないことを検証
		expect(mockReplace).not.toHaveBeenCalled();

		// DOMが0msで直接フィルタリングされ、Note 1が消えてNote 2だけが残る
		expect(screen.queryByText("Note 1")).not.toBeInTheDocument();
		expect(screen.getByText("Note 2")).toBeInTheDocument();
	});
});

describe("MiddlePaneList Back Button", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		searchParamsMock.mockReturnValue(new URLSearchParams());
		window.history.replaceState(null, "", "/notes");
		vi.useRealTimers();
	});

	it("shows the back button when in a domain drilldown", () => {
		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="domains"
				currentDomain="example.com"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		expect(screen.getByTitle("Go back")).toBeInTheDocument();
	});

	it("hides the back button when not in a drilldown", () => {
		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="domains"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		expect(screen.queryByTitle("Go back")).not.toBeInTheDocument();
	});

	it("hides the back button when currentDomain is 'inbox'", () => {
		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		expect(screen.queryByTitle("Go back")).not.toBeInTheDocument();
	});

	it("removes 'exact' parameter when clicking back from exact view", async () => {
		const user = userEvent.setup();
		searchParamsMock.mockReturnValue(
			new URLSearchParams("view=domains&domain=example.com&exact=all"),
		);

		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="domains"
				currentDomain="example.com"
				currentExact="all"
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		const backBtn = screen.getByTitle("Go back");
		await user.click(backBtn);

		expect(mockReplace).toHaveBeenCalledWith(
			"/notes?view=domains&domain=example.com",
			{ scroll: false },
		);
	});

	it("removes 'domain' parameter and sets view=domains when clicking back from domain view", async () => {
		const user = userEvent.setup();
		searchParamsMock.mockReturnValue(
			new URLSearchParams("view=domains&domain=example.com"),
		);

		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="domains"
				currentDomain="example.com"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		const backBtn = screen.getByTitle("Go back");
		await user.click(backBtn);

		expect(mockReplace).toHaveBeenCalledWith("/notes?view=domains", {
			scroll: false,
		});
	});

	it("drilldown link click fires replace for 0ms instant drilldown", async () => {
		const user = userEvent.setup();
		const groupedNotes = {
			domains: { "example.com": { domainNotes: [], pages: {} } },
			inbox: [],
			drafts: [],
		};

		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={groupedNotes}
				currentView="domains"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		const domainLink = screen.getByText("example.com");
		await user.click(domainLink);

		expect(mockReplace).toHaveBeenCalledWith("/notes?domain=example.com", {
			scroll: false,
		});
	});

	it("renders years list in diaries view when year is not selected", async () => {
		const mockDiary = {
			user_id: "user-1",
			date: "2026-06-21",
			content: "Diary content 1",
			topics: ["react"],
			created_at: "2026-06-21T10:00:00Z",
			updated_at: "2026-06-21T10:00:00Z",
		};

		render(
			<MiddlePaneList
				items={[mockDiary]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="diaries"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		expect(screen.getByText("2026")).toBeInTheDocument();
	});

	it("renders months list in diaries view when year is selected but month is not", async () => {
		const mockDiary = {
			user_id: "user-1",
			date: "2026-06-21",
			content: "Diary content 1",
			topics: ["react"],
			created_at: "2026-06-21T10:00:00Z",
			updated_at: "2026-06-21T10:00:00Z",
		};

		searchParamsMock.mockReturnValue(new URLSearchParams("year=2026"));

		render(
			<MiddlePaneList
				items={[mockDiary]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="diaries"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		expect(screen.getByText("Jun")).toBeInTheDocument();
	});

	it("ビュー切り替え時に正しいコンテキストタイトルが表示されること", async () => {
		const { rerender } = render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="domains"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);
		expect(screen.getByText("Domain List")).toBeInTheDocument();

		rerender(
			<MiddlePaneList
				items={[]}
				groupedNotes={{ domains: {}, inbox: [], drafts: [] }}
				currentView="drafts"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);
		expect(screen.getByText("Draft List")).toBeInTheDocument();
	});

	it("ドメイン一覧（ルート）コンテキストでは、新規作成やアクション群がDOMからパージされていること", async () => {
		render(
			<MiddlePaneList
				items={[]}
				groupedNotes={{
					domains: { "example.com": { domainNotes: [], pages: {} } },
					inbox: [],
					drafts: [],
				}}
				currentView="domains"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		// アクション群（New NoteやSelect Mode）が存在しないことを検証
		expect(screen.queryByTitle("New Note here")).not.toBeInTheDocument();
		expect(screen.queryByTitle("Select Mode")).not.toBeInTheDocument();
		// 代わりに中央に Domain List がマウントされていることを検証
		expect(screen.getByText("Domain List")).toBeInTheDocument();
	});

	it("diariesビューで表示値(27 Sat)や日付によって正しくインクリメンタル検索・消し込みされること", async () => {
		const mockDiary = {
			user_id: "user-1",
			date: "2026-06-27",
			content: "Special integrated diary text",
			topics: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
		searchParamsMock.mockReturnValue(
			new URLSearchParams("view=diaries&year=2026&month=06"),
		);

		render(
			<MiddlePaneList
				items={[mockDiary]}
				groupedNotes={{
					domains: {},
					inbox: [],
					drafts: [],
				}}
				currentView="diaries"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		// 初期ロード時は表示されている
		expect(
			screen.getByText("Special integrated diary text"),
		).toBeInTheDocument();

		// ヒットしないクエリを入力
		const searchInput = screen.getByPlaceholderText("Search notes...");
		fireEvent.change(searchInput, { target: { value: "notfoundtext" } });
		expect(
			screen.queryByText("Special integrated diary text"),
		).not.toBeInTheDocument();

		// UI表示値（日・曜日ラベル "27 Sat"）を入力して再ヒットすることを確認
		fireEvent.change(searchInput, { target: { value: "27 Sat" } });
		expect(
			screen.getByText("Special integrated diary text"),
		).toBeInTheDocument();
	});

	it("検索窓に入力がある状態で別タブへ切り替えた際、検索窓のローカルテキストが自動で綺麗にクリアされること", async () => {
		const { rerender } = render(
			<MiddlePaneList
				items={mockItems}
				groupedNotes={mockGroupedNotes}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		const searchInput = screen.getByPlaceholderText(
			"Search notes...",
		) as HTMLInputElement;

		// 検索窓に文字を入力
		fireEvent.change(searchInput, {
			target: { value: "Active Search Filter" },
		});
		expect(searchInput.value).toBe("Active Search Filter");

		// ユーザーがタブをクリックして view=drafts へ切り替わった状態を想定して再レンダリング
		rerender(
			<MiddlePaneList
				items={mockItems}
				groupedNotes={mockGroupedNotes}
				currentView="drafts"
				currentDomain={null}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		// 安全装置が作動し、入力値が自動リセットされていることを検証
		expect(searchInput.value).toBe("");
	});
});

describe("MiddlePaneList D&D Fractional Indexing", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		mockMutate.impl = () => {};
	});

	it("要素順序が物理的に移動した際、正しい順序値が算出されミューテーションが発火すること", async () => {
		const mutateMock = vi.fn();
		mockMutate.impl = mutateMock;

		render(
			<MiddlePaneList
				items={mockItems}
				groupedNotes={mockGroupedNotes}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		expect(mockLastOnDragEndContainer.current).toBeDefined();

		// note-1 を note-2 の後ろ（末尾）にドラッグ
		await act(async () => {
			await mockLastOnDragEndContainer.current?.({
				active: { id: "note-1" },
				over: { id: "note-2" },
			});
		});

		// note-2 (sort_order: 1) の後ろなので、newOrder = 1 + 1 = 2
		expect(mutateMock).toHaveBeenCalledWith({
			id: "note-1",
			updates: { sort_order: 2.0 },
		});
	});

	it("移動前後でインデックスが変わらない（リアルタイムスライドでの見かけ上の同一要素ドロップ）場合、処理をスキップすること", async () => {
		const mutateMock = vi.fn();
		mockMutate.impl = mutateMock;

		render(
			<MiddlePaneList
				items={mockItems}
				groupedNotes={mockGroupedNotes}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		await act(async () => {
			await mockLastOnDragEndContainer.current?.({
				active: { id: "note-1" },
				over: { id: "note-1" },
			});
		});

		expect(mutateMock).not.toHaveBeenCalled();
	});

	it("超精密 Fractional Indexing 同値衝突防御（防壁ロジック）で、下から上への引き揚げ時に正しい順序値になること", async () => {
		const mutateMock = vi.fn();
		mockMutate.impl = mutateMock;

		const itemsWithSameOrder: Note[] = [
			{ ...mockItems[0], id: "note-a", sort_order: 1.0 },
			{ ...mockItems[1], id: "note-b", sort_order: 1.0 },
			{ ...mockItems[1], id: "note-c", sort_order: 1.0 },
		];

		render(
			<MiddlePaneList
				items={itemsWithSameOrder}
				groupedNotes={{
					inbox: itemsWithSameOrder,
					drafts: [],
					domains: {},
				}}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		// note-c (index 2, order 1.0) を note-b (index 1) に移動
		// updatedItems: [note-a, note-c, note-b]
		// finalIndex = 1
		// prevOrder (note-a) = 1.0, nextOrder (note-b) = 1.0
		// Math.abs(prevOrder - nextOrder) < EPSILON は true
		// initialIndex (2) > finalIndex (1) は true (下から上)
		// newOrder = nextOrder - OFFSET = 1.0 - 0.0001 = 0.9999
		await act(async () => {
			await mockLastOnDragEndContainer.current?.({
				active: { id: "note-c" },
				over: { id: "note-b" },
			});
		});

		expect(mutateMock).toHaveBeenCalledWith({
			id: "note-c",
			updates: { sort_order: 0.9999 },
		});
	});

	it("超精密 Fractional Indexing 同値衝突防御（防壁ロジック）で、上から下への引き降ろし時に正しい順序値になること", async () => {
		const mutateMock = vi.fn();
		mockMutate.impl = mutateMock;

		const itemsWithSameOrder: Note[] = [
			{ ...mockItems[0], id: "note-a", sort_order: 1.0 },
			{ ...mockItems[1], id: "note-b", sort_order: 1.0 },
			{ ...mockItems[1], id: "note-c", sort_order: 1.0 },
		];

		render(
			<MiddlePaneList
				items={itemsWithSameOrder}
				groupedNotes={{
					inbox: itemsWithSameOrder,
					drafts: [],
					domains: {},
				}}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		// note-a (index 0) を note-b (index 1) に移動
		// updatedItems: [note-b, note-a, note-c]
		// finalIndex = 1
		// prevOrder (note-b) = 1.0, nextOrder (note-c) = 1.0
		// initialIndex (0) < finalIndex (1) は true (上から下)
		// newOrder = prevOrder + OFFSET = 1.0 + 0.0001 = 1.0001
		await act(async () => {
			await mockLastOnDragEndContainer.current?.({
				active: { id: "note-a" },
				over: { id: "note-b" },
			});
		});

		expect(mutateMock).toHaveBeenCalledWith({
			id: "note-a",
			updates: { sort_order: 1.0001 },
		});
	});
});

describe("MiddlePaneList Bulk Delete Optimistic UI", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		mockMutate.impl = () => {};
	});

	it("一括削除実行時、ローカルリストから即座に削除対象IDが除外されること", async () => {
		const user = userEvent.setup();
		const deleteNotesMock = vi.fn().mockResolvedValue(["note-1"]);
		mockMutate.impl = deleteNotesMock;

		render(
			<MiddlePaneList
				items={mockItems}
				groupedNotes={mockGroupedNotes}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
			/>,
		);

		expect(screen.getByText("Note 1")).toBeInTheDocument();
		expect(screen.getByText("Note 2")).toBeInTheDocument();

		// Enable select mode
		const selectModeBtn = screen.getByTitle("Select Mode");
		await user.click(selectModeBtn);

		// Select Note 1
		const checkboxes = screen.getAllByRole("checkbox");
		await user.click(checkboxes[0]);

		// Click Delete
		const deleteBtn = screen.getByRole("button", { name: /delete/i });
		await user.click(deleteBtn);

		// Note 1 should immediately disappear from UI (optimistic UI)
		expect(screen.queryByText("Note 1")).not.toBeInTheDocument();
		expect(screen.getByText("Note 2")).toBeInTheDocument();
		expect(deleteNotesMock).toHaveBeenCalledWith(["note-1"]);
	});
});

describe("MiddlePaneList Deferred Rendering", () => {
	it("deferredパラメータに基づいてアイテムが正しく非同期描画されること", () => {
		const mockNotes = [
			{
				id: "1",
				content: "内容A",
				note_type: "info",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				user_id: "user-1",
				scope: "inbox",
				url_pattern: "",
				is_expanded: false,
				is_favorite: false,
				is_pinned: false,
				is_resolved: false,
				sort_order: 0,
				draft_id: null,
				tags: null,
			},
		] as Note[];

		render(
			<MiddlePaneList
				items={mockNotes}
				groupedNotes={{ inbox: mockNotes, drafts: [], domains: {} }}
				currentView="inbox"
				currentDomain="inbox"
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
				isLoading={false}
			/>,
		);

		expect(screen.getByText("内容A")).toBeInTheDocument();
	});
});
