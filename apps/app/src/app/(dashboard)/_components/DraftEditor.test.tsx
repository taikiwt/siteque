import type { Draft } from "@sitecue/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { Toaster } from "react-hot-toast";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../../../vitest.setup";
import DraftEditor from "./DraftEditor";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: mockReplace,
		back: mockBack,
		refresh: mockRefresh,
	}),
	useSearchParams: () => new URLSearchParams("tab=review"),
}));

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: true,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock Supabase Auth / Client
vi.mock("@/utils/supabase/client", () => {
	const mockSupabase = {
		auth: {
			getUser: vi.fn().mockResolvedValue({
				data: { user: { id: "user-123" } },
			}),
			getSession: vi.fn().mockResolvedValue({
				data: {
					session: { access_token: "mock-token", user: { id: "user-123" } },
				},
			}),
		},
		from: vi.fn(() => ({
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			order: vi.fn().mockResolvedValue({ data: [], error: null }),
			maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
			insert: vi.fn().mockReturnValue({
				select: vi.fn().mockReturnValue({
					single: vi.fn().mockResolvedValue({
						data: { id: "draft-new", title: "New Title", content: "Content" },
						error: null,
					}),
				}),
			}),
			update: vi.fn().mockReturnValue({
				eq: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						single: vi.fn().mockResolvedValue({
							data: {
								id: "draft-1",
								title: "Updated Title",
								content: "Content",
							},
							error: null,
						}),
					}),
				}),
			}),
		})),
	};
	return { createClient: () => mockSupabase };
});

const mockDraft: Draft = {
	id: "draft-1",
	content: "Test Content",
	title: "Test Title",
	metadata: { slug: "test-slug" },
	created_at: new Date().toISOString(),
	updated_at: new Date().toISOString(),
	user_id: "user-123",
	template_id: null,
	tags: null,
};

describe("DraftEditor - Error Handling & Architecture", () => {
	const createTestQueryClient = () =>
		new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});

	it("Weave機能がAPIエラーになった際、エラーメッセージがトーストで表示されること", async () => {
		server.use(
			http.post("*/ai/weave", () => {
				return HttpResponse.json(
					{ error: "Internal Server Error" },
					{ status: 500 },
				);
			}),
		);

		const renderWithProvider = (ui: React.ReactElement) => {
			const queryClient = createTestQueryClient();
			return render(
				<QueryClientProvider client={queryClient}>
					<Toaster />
					{ui}
				</QueryClientProvider>,
			);
		};

		const user = userEvent.setup();

		renderWithProvider(
			<DraftEditor initialDraft={mockDraft} template={null} />,
		);

		const weaveButtons = await screen.findAllByRole("button", {
			name: /weave/i,
		});
		await user.click(weaveButtons[0]);

		expect(
			await screen.findByText(
				"The AI server is currently busy. Please wait a moment and try again.",
			),
		).toBeInTheDocument();
	});

	it("手元キャッシュ（オブジェクト形式含む）から0msでデータが復元され、スケルトンなしで即時描画されること", async () => {
		const queryClient = createTestQueryClient();
		// オブジェクト形式キャッシュで注入
		queryClient.setQueryData(["drafts"], { drafts: [mockDraft], notes: [] });

		render(
			<QueryClientProvider client={queryClient}>
				<DraftEditor draftId="draft-1" initialDraft={mockDraft} />
			</QueryClientProvider>,
		);

		expect(screen.getAllByDisplayValue("Test Title")[0]).toBeInTheDocument();
		expect(screen.getAllByText("SELF REVIEW")[0]).toBeInTheDocument();
		expect(screen.getAllByText("GLOBAL MATERIALS")[0]).toBeInTheDocument();
	});

	it("新規保存時に router.refresh() を呼ばずに setQueriesData で0ms注入後に router.replace を直列実行すること", async () => {
		const queryClient = createTestQueryClient();
		const user = userEvent.setup();

		render(
			<QueryClientProvider client={queryClient}>
				<DraftEditor />
			</QueryClientProvider>,
		);

		const titleInput = screen.getAllByPlaceholderText("Title (optional)")[0];
		await user.type(titleInput, "New Title");

		const saveButton = screen.getAllByRole("button", { name: /^Save$/i })[0];
		await user.click(saveButton);

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith(
				expect.stringContaining("/studio/"),
				{ scroll: false },
			);
			expect(mockRefresh).not.toHaveBeenCalled();
		});
	});

	it("タブ切替（SELF REVIEW ⇔ GLOBAL MATERIALS）が即座にトグル可能であること", async () => {
		const queryClient = createTestQueryClient();
		const user = userEvent.setup();
		render(
			<QueryClientProvider client={queryClient}>
				<DraftEditor />
			</QueryClientProvider>,
		);

		const reviewTab = screen.getAllByRole("button", { name: "SELF REVIEW" })[0];
		const materialsTab = screen.getAllByRole("button", {
			name: "GLOBAL MATERIALS",
		})[0];

		expect(reviewTab).toBeInTheDocument();
		expect(materialsTab).toBeInTheDocument();

		await user.click(materialsTab);
		expect(
			screen.getAllByPlaceholderText(/search.*materials/i)[0],
		).toBeInTheDocument();
	});
});

describe("DraftEditor - Local Suspense Shell Protection", () => {
	it("ローディング状態でも Header とタイトル領域が 0ms で破綻なく描画されること", () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		render(
			<QueryClientProvider client={queryClient}>
				<DraftEditor draftId="draft-1" />
			</QueryClientProvider>,
		);

		// Header とタイトル入力領域の存在確認（0ms即時表示）
		expect(
			screen.getAllByRole("button", { name: /^Save$/i })[0],
		).toBeInTheDocument();
		expect(
			screen.getAllByPlaceholderText("Title (optional)")[0],
		).toBeInTheDocument();
	});
});
