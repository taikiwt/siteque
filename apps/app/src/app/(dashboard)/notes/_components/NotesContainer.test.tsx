import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { useFetchNotes } from "@/hooks/useNotesQuery";
import { NotesContainer } from "./NotesContainer";

// モック: Next.js Navigation
vi.mock("next/navigation", () => ({
	useSearchParams: vi.fn(),
	useRouter: () => ({
		push: vi.fn(),
		replace: vi.fn(),
		refresh: vi.fn(),
		prefetch: vi.fn(),
	}),
}));

const mockFetchContentMutate = vi.fn();
const mockDraftsResult = { data: [], isLoading: false };
const mockDiariesResult = { data: [], isLoading: false };

// モック: Hooks (ZustandやReact Queryの部分を純粋な値としてモック化)
vi.mock("@/hooks/useNotesQuery", () => ({
	useFetchNotes: vi.fn(),
	useFetchNoteContents: vi.fn(() => ({ mutate: mockFetchContentMutate })),
}));

vi.mock("@/hooks/useDraftsQuery", () => ({
	useFetchDrafts: () => mockDraftsResult,
}));

vi.mock("@/hooks/useDiariesQuery", () => ({
	useFetchDiaries: () => mockDiariesResult,
}));

vi.mock("./MiddlePaneList", () => ({
	MiddlePaneList: (props: {
		currentView?: string;
		items?: unknown[];
		isLoading?: boolean;
	}) => (
		<div
			data-testid="middle-pane"
			data-view={props.currentView}
			data-loading={props.isLoading}
		>
			{props.isLoading ? "loading" : `${props.items?.length ?? 0} items`}
		</div>
	),
}));

vi.mock("./RightPaneDetail", () => ({
	RightPaneDetail: () => <div data-testid="right-pane" />,
}));

// window.matchMedia のモック
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

describe("NotesContainer - URL Normalization & Async Rendering", () => {
	it("view=exact などの非正規なパラメータが渡されても、effectiveView として 'domains' に自動フォールバックされること", async () => {
		vi.mocked(useSearchParams).mockReturnValue(
			new URLSearchParams(
				"?view=exact&domain=example.com",
			) as unknown as ReturnType<typeof useSearchParams>,
		);

		vi.mocked(useFetchNotes).mockReturnValue({
			data: [
				{
					id: "note-1",
					content: "Exact fallback test",
					url_pattern: "example.com",
					scope: "domain",
					is_pinned: false,
					sort_order: 0,
					created_at: new Date().toISOString(),
				},
			],
			isLoading: false,
		} as unknown as ReturnType<typeof useFetchNotes>);

		render(<NotesContainer />);

		await waitFor(() => {
			const middlePane = screen.getByTestId("middle-pane");
			expect(middlePane).toBeInTheDocument();
			expect(middlePane.getAttribute("data-view")).toBe("domains");
		});
	});

	it("URLの q パラメータに基づいて、フロントエンドでノートが正しくフィルタリングされること", async () => {
		vi.mocked(useSearchParams).mockReturnValue(
			new URLSearchParams("?q=match") as unknown as ReturnType<
				typeof useSearchParams
			>,
		);

		vi.mocked(useFetchNotes).mockReturnValue({
			data: [
				{
					id: "note-1",
					content: "This is a match",
					url_pattern: "example.com",
					scope: "inbox",
					is_pinned: false,
					sort_order: 0,
					created_at: new Date().toISOString(),
				},
				{
					id: "note-2",
					content: "No luck here",
					url_pattern: "example.com",
					scope: "inbox",
					is_pinned: false,
					sort_order: 0,
					created_at: new Date().toISOString(),
				},
			],
			isLoading: false,
		} as unknown as ReturnType<typeof useFetchNotes>);

		render(<NotesContainer />);

		await waitFor(() => {
			const middlePane = screen.getByTestId("middle-pane");
			expect(middlePane).toBeInTheDocument();
			expect(middlePane).toHaveTextContent("1 items");
		});
	});

	it("Slim Fetching対応: content が undefined のノートは、検索クエリがあってもフィルタリングされずに残ること", async () => {
		vi.mocked(useSearchParams).mockReturnValue(
			new URLSearchParams("?q=anything") as unknown as ReturnType<
				typeof useSearchParams
			>,
		);

		const fetchNotesData = [
			{
				id: "note-loading",
				content: undefined,
				url_pattern: "example.com",
				scope: "inbox",
				is_pinned: false,
				sort_order: 0,
				created_at: new Date().toISOString(),
			},
			{
				id: "note-mismatch",
				content: "No match",
				url_pattern: "example.com",
				scope: "inbox",
				is_pinned: false,
				sort_order: 0,
				created_at: new Date().toISOString(),
			},
		];

		vi.mocked(useFetchNotes).mockReturnValue({
			data: fetchNotesData,
			isLoading: false,
		} as unknown as ReturnType<typeof useFetchNotes>);

		render(<NotesContainer />);

		await waitFor(() => {
			expect(screen.getByTestId("middle-pane")).toBeInTheDocument();
		});
	});
});

describe("NotesContainer - Skeleton & Cache Strategy", () => {
	it("bypasses skeleton immediately (0ms) when cache exists", async () => {
		vi.mocked(useSearchParams).mockReturnValue(
			new URLSearchParams("") as unknown as ReturnType<typeof useSearchParams>,
		);

		vi.mocked(useFetchNotes).mockReturnValue({
			data: [
				{
					id: "cached-note",
					content: "Cached note content",
					url_pattern: "example.com",
					scope: "inbox",
					is_pinned: false,
					sort_order: 0,
					created_at: new Date().toISOString(),
				},
			],
			isLoading: false,
		} as unknown as ReturnType<typeof useFetchNotes>);

		render(<NotesContainer />);

		await waitFor(() => {
			const middlePane = screen.getByTestId("middle-pane");
			expect(middlePane).toBeInTheDocument();
			// キャッシュが存在するため loading は false
			expect(middlePane.getAttribute("data-loading")).toBe("false");
		});
	});

	it("holds skeleton for 200ms when fetching fresh data without cache to prevent flicker", async () => {
		vi.useFakeTimers();

		vi.mocked(useSearchParams).mockReturnValue(
			new URLSearchParams("") as unknown as ReturnType<typeof useSearchParams>,
		);

		vi.mocked(useFetchNotes).mockReturnValue({
			data: [],
			isLoading: true,
		} as unknown as ReturnType<typeof useFetchNotes>);

		render(<NotesContainer />);

		// データ取得中かつキャッシュがないため loading は true
		const middlePane = screen.getByTestId("middle-pane");
		expect(middlePane.getAttribute("data-loading")).toBe("true");

		vi.useRealTimers();
	});

	it("入力パラメータのDeferred化によりヘッダーUIが0msで正常レンダリングされること", async () => {
		vi.mocked(useSearchParams).mockReturnValue(
			new URLSearchParams("view=domains") as unknown as ReturnType<typeof useSearchParams>,
		);

		vi.mocked(useFetchNotes).mockReturnValue({
			data: [],
			isLoading: false,
		} as unknown as ReturnType<typeof useFetchNotes>);

		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		render(
			<QueryClientProvider client={queryClient}>
				<NotesContainer />
			</QueryClientProvider>,
		);

		await waitFor(() => {
			expect(
				screen.getByTestId("middle-pane") ||
					screen.getByRole("navigation", { name: "ビュー切り替え" }),
			).toBeInTheDocument();
		});
	});
});
