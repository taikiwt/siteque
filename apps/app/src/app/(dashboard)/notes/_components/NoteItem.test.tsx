import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../types";
import { NoteItem } from "./NoteItem";

describe("NoteItem", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("Resolves item after 400ms with exit animation", async () => {
		const mockResolve = vi.fn();
		const mockNote = {
			id: "123",
			content: "Test Note",
			is_resolved: false,
			note_type: "info",
			created_at: new Date().toISOString(),
			scope: "domain",
		} as Note;

		render(
			<NoteItem
				item={mockNote}
				onTodoToggle={mockResolve}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
				searchParams={new URLSearchParams()}
			/>,
		);

		// Find the resolve button (within NoteStatusBadge)
		const resolveBtn = screen.getByRole("button", { name: /info/i });
		fireEvent.click(resolveBtn);

		// 1. Check if classes are applied immediately
		const container = screen.getByTestId("note-item");
		expect(container.className).toContain("opacity-50");
		expect(container.className).toContain("line-through");
		expect(container.className).toContain("pointer-events-none");

		// 2. onTodoToggle should NOT have been called yet
		expect(mockResolve).not.toHaveBeenCalled();

		// 3. Advance timers by 400ms
		act(() => {
			vi.advanceTimersByTime(400);
		});

		// 4. Verify it was called after delay
		expect(mockResolve).toHaveBeenCalledWith(expect.anything(), "123", false);
		expect(mockResolve).toHaveBeenCalledTimes(1);
	});

	it("Does not delay when toggling from resolved to unresolved", () => {
		const mockResolve = vi.fn();
		const mockNote = {
			id: "123",
			content: "Test Note",
			is_resolved: true,
			note_type: "info",
			created_at: new Date().toISOString(),
			scope: "domain",
		} as Note;

		render(
			<NoteItem
				item={mockNote}
				onTodoToggle={mockResolve}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
				searchParams={new URLSearchParams()}
			/>,
		);

		const resolveBtn = screen.getByRole("button", { name: /info/i });
		fireEvent.click(resolveBtn);

		// Should be called immediately
		expect(mockResolve).toHaveBeenCalledWith(expect.anything(), "123", true);
		expect(mockResolve).toHaveBeenCalledTimes(1);
	});

	it("renders Pin button and triggers onPinToggle with event propagation stopped", () => {
		const mockPinToggle = vi.fn();
		const mockNote = {
			id: "note-123",
			content: "Test Note Content",
			is_pinned: false,
			is_resolved: false,
			note_type: "info",
			created_at: new Date().toISOString(),
			scope: "domain",
		} as Note;

		render(
			<NoteItem
				item={mockNote}
				onPinToggle={mockPinToggle}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
				searchParams={new URLSearchParams()}
			/>,
		);

		const pinButton = screen.getByRole("button", { name: /pin note/i });
		expect(pinButton).toBeInTheDocument();

		fireEvent.click(pinButton);

		expect(mockPinToggle).toHaveBeenCalledWith(
			expect.anything(),
			"note-123",
			false,
		);
		expect(mockPinToggle).toHaveBeenCalledTimes(1);
	});

	it("renders active style when note is pinned", () => {
		const mockNote = {
			id: "note-pinned",
			content: "Pinned Note",
			is_pinned: true,
			is_resolved: false,
			note_type: "info",
			created_at: new Date().toISOString(),
			scope: "domain",
		} as Note;

		render(
			<NoteItem
				item={mockNote}
				currentExact={null}
				selectedNoteId={null}
				selectedDraftId={null}
				searchParams={new URLSearchParams()}
			/>,
		);

		const pinButton = screen.getByRole("button", { name: /unpin note/i });
		expect(pinButton.className).toContain("text-action");
	});

	it("hides drag handle when isSortable is false (e.g. All Notes)", () => {
		const mockNote = {
			id: "note-123",
			content: "Test Note Content",
			is_pinned: false,
			is_resolved: false,
			note_type: "info",
			created_at: new Date().toISOString(),
			scope: "domain",
		} as Note;

		render(
			<NoteItem
				item={mockNote}
				isSortable={false}
				currentExact="all"
				selectedNoteId={null}
				selectedDraftId={null}
				searchParams={new URLSearchParams()}
			/>,
		);

		expect(screen.queryByLabelText("Drag to reorder")).not.toBeInTheDocument();
	});
});
