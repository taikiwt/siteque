import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Note } from "../types";
import { RightPaneDetail } from "./RightPaneDetail";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush, replace: mockReplace }),
	useSearchParams: () => mockSearchParams,
}));

vi.mock("@/hooks/useDiariesQuery", () => ({
	useFetchDiaries: () => ({ data: [] }),
}));

const mockCreateNoteMutateAsync = vi.fn();
const mockUpdateNoteMutateAsync = vi.fn();
const mockDeleteNoteMutateAsync = vi.fn();

vi.mock("@/hooks/useNotesQuery", () => ({
	useCreateNote: () => ({ mutateAsync: mockCreateNoteMutateAsync }),
	useUpdateNote: () => ({ mutateAsync: mockUpdateNoteMutateAsync }),
	useDeleteNote: () => ({ mutateAsync: mockDeleteNoteMutateAsync }),
}));

describe("RightPaneDetail - SWRBoundary Key Isolation", () => {
	it("bypasses skeleton immediately (0ms) when note with content is selected", () => {
		const noteWithContent = {
			id: "note-cached-1",
			created_at: "2026-07-28T00:00:00Z",
			updated_at: "2026-07-28T00:00:00Z",
			content: "Cached Note Content Here",
			note_type: "info",
			scope: "inbox",
			url_pattern: "",
			is_resolved: false,
			is_pinned: false,
			is_favorite: false,
		} as Note;

		render(<RightPaneDetail note={noteWithContent} />);

		// 0ms でスケルトンが出ずに即座に本文が表示されること
		expect(screen.queryByTestId("detail-skeleton")).not.toBeInTheDocument();
		expect(screen.getByText("Cached Note Content Here")).toBeInTheDocument();
	});

	it("renders detailed aligned skeleton when isLoading is true even without note", () => {
		render(<RightPaneDetail isLoading={true} />);

		const skeleton = screen.getByTestId("detail-skeleton");
		expect(skeleton).toBeInTheDocument();
		// 本文エリアの min-h-50 が骨格として確保されていること
		expect(skeleton.querySelector(".min-h-50")).toBeInTheDocument();
	});

	it("renders aligned skeleton when switching to a note with undefined content", () => {
		const partialNote = {
			id: "note-uncached-2",
			created_at: "2026-07-28T00:00:00Z",
			updated_at: "2026-07-28T00:00:00Z",
			content: undefined as unknown as string,
			note_type: "info",
			scope: "inbox",
			url_pattern: "",
			is_resolved: false,
			is_pinned: false,
			is_favorite: false,
		} as Note;

		render(<RightPaneDetail note={partialNote} />);

		const skeleton = screen.getByTestId("detail-skeleton");
		expect(skeleton).toBeInTheDocument();
		expect(skeleton.querySelector(".min-h-50")).toBeInTheDocument();
	});
});

describe("RightPaneDetail - SWRBoundary with isDataReady", () => {
	it("renders content immediately (0ms) when note.content is cached and defined", () => {
		const cachedNote = {
			id: "cached-note-1",
			created_at: "2026-07-28T00:00:00Z",
			updated_at: "2026-07-28T00:00:00Z",
			content: "Instant Cached Body",
			note_type: "info",
			scope: "inbox",
			url_pattern: "",
			is_resolved: false,
			is_pinned: false,
			is_favorite: false,
		} as Note;

		render(<RightPaneDetail note={cachedNote} />);

		expect(screen.queryByTestId("detail-skeleton")).not.toBeInTheDocument();
		expect(screen.getByText("Instant Cached Body")).toBeInTheDocument();
	});
});

describe("RightPaneDetail - New Note Scope & NoteType Integration", () => {
	it("saves note with exact scope and user-entered URL when user changes scope to Page", async () => {
		mockSearchParams = new URLSearchParams("?domain=example.com&new=note");
		mockCreateNoteMutateAsync.mockResolvedValueOnce({
			id: "new-note-123",
			scope: "exact",
			url_pattern: "example.com/sub-page",
			note_type: "info",
			content: "Page note content",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			is_pinned: false,
			is_resolved: false,
			is_favorite: false,
			sort_order: 0,
		});

		render(<RightPaneDetail isNewNote={true} />);

		// Scope を Page に切り替え
		const pageButton = screen.getByRole("button", { name: "Page" });
		fireEvent.click(pageButton);

		// URL 入力欄に exact URL を入力
		const urlInput = screen.getByPlaceholderText("https://...");
		fireEvent.change(urlInput, {
			target: { value: "https://example.com/sub-page" },
		});

		// 本文を入力（CodeMirror の onChange 相当）
		const textarea = screen.getByPlaceholderText("What's on your mind?");
		fireEvent.change(textarea, { target: { value: "Page note content" } });

		// Save ボタンをクリック
		const saveButton = screen.getByRole("button", { name: "Save" });
		fireEvent.click(saveButton);

		await waitFor(() => {
			expect(mockCreateNoteMutateAsync).toHaveBeenCalledWith({
				content: "Page note content",
				scope: "exact",
				note_type: "info",
				currentUrl: "example.com/sub-page",
			});
			expect(mockReplace).toHaveBeenCalledWith(
				`/notes?domain=example.com&view=domains&exact=${encodeURIComponent("example.com/sub-page")}&noteId=new-note-123`,
			);
		});
	});

	it("initializes editNoteType from URL searchParams 'type'", async () => {
		mockSearchParams = new URLSearchParams(
			"?domain=example.com&new=note&type=alert",
		);
		mockCreateNoteMutateAsync.mockResolvedValueOnce({
			id: "alert-note-456",
			scope: "domain",
			url_pattern: "example.com",
			note_type: "alert",
			content: "Alert note content",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			is_pinned: false,
			is_resolved: false,
			is_favorite: false,
			sort_order: 0,
		});

		render(<RightPaneDetail isNewNote={true} />);

		// 本文入力
		const textarea = screen.getByPlaceholderText("What's on your mind?");
		fireEvent.change(textarea, { target: { value: "Alert note content" } });

		// Save 実行
		const saveButton = screen.getByRole("button", { name: "Save" });
		fireEvent.click(saveButton);

		await waitFor(() => {
			expect(mockCreateNoteMutateAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					note_type: "alert",
				}),
			);
		});
	});
});
