import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useUserStore } from "@/store/useUserStore";
import { GlobalNewNoteDialog } from "./GlobalNewNoteDialog";

// CodeMirror モック
vi.mock("@uiw/react-codemirror", () => ({
	default: ({
		value,
		onChange,
		placeholder,
	}: {
		value: string;
		onChange: (v: string) => void;
		placeholder?: string;
	}) => (
		<textarea
			data-testid="codemirror-mock"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			placeholder={placeholder}
		/>
	),
}));

// next/navigation モック
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockRefresh = vi.fn();
const mockUseSearchParams = vi.fn(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: mockReplace,
		refresh: mockRefresh,
	}),
	useSearchParams: () => mockUseSearchParams(),
}));

// Toast モック
vi.mock("react-hot-toast", () => ({
	default: { error: vi.fn(), success: vi.fn() },
}));

// Mutation フック モック
const mockCreateMutate = vi.fn();
const mockAppendMutate = vi.fn();
vi.mock("@/hooks/useNotesQuery", () => ({
	useCreateNote: () => ({
		mutate: mockCreateMutate,
	}),
}));
vi.mock("@/hooks/useDiariesQuery", () => ({
	useFetchDiaries: vi.fn(() => ({ data: [] })),
	useAppendDiary: () => ({
		mutate: mockAppendMutate,
	}),
}));

// NotesEditor モック
vi.mock("@/components/editor/NotesEditor", () => ({
	NotesEditor: ({
		onChange,
		value,
		onSave,
	}: {
		onChange: (val: string) => void;
		value: string;
		onSave?: () => void;
	}) => (
		<div>
			<textarea
				data-testid="notes-editor"
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
			<button type="button" data-testid="trigger-onsave" onClick={onSave}>
				Trigger OnSave
			</button>
		</div>
	),
}));

function renderWithProviders(ui: React.ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe("GlobalNewNoteDialog Component", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		mockCreateMutate.mockReset();
		mockAppendMutate.mockReset();
		useUserStore.setState({ isPaywallOpen: false });
		useLayoutStore.setState({
			globalNewModal: { isOpen: false, mode: "gate" },
		});
		mockUseSearchParams.mockReturnValue(new URLSearchParams(""));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("Daily Diaryモードにおいて、送信時にLogging...表示になり500ms後にダイアログが閉じること（toast.successなし）", () => {
		useLayoutStore.getState().openGlobalNewModal("diary");

		renderWithProviders(<GlobalNewNoteDialog />);

		const textarea = screen.getByPlaceholderText(
			/Write down your thoughts for today/i,
		);
		fireEvent.change(textarea, { target: { value: "Today's log" } });

		const saveBtn = screen.getByRole("button", { name: "Save Diary" });
		fireEvent.click(saveBtn);

		expect(
			screen.getByRole("button", { name: "Logging..." }),
		).toBeInTheDocument();

		expect(mockAppendMutate).toHaveBeenCalledWith(
			expect.objectContaining({ text: "Today's log" }),
			expect.anything(),
		);

		act(() => {
			vi.advanceTimersByTime(500);
		});

		expect(useLayoutStore.getState().globalNewModal.isOpen).toBe(false);
		expect(toast.success).not.toHaveBeenCalled();
	});

	it("Quick Noteモードにおいて、送信時にSaving...表示になり500ms後にダイアログが閉じること", () => {
		useLayoutStore.getState().openGlobalNewModal("note");

		renderWithProviders(<GlobalNewNoteDialog />);

		const editor = screen.getByTestId("notes-editor");
		fireEvent.change(editor, { target: { value: "Quick idea text" } });

		const saveBtn = screen.getByRole("button", { name: "Save Note" });
		fireEvent.click(saveBtn);

		expect(
			screen.getByRole("button", { name: "Saving..." }),
		).toBeInTheDocument();

		expect(mockCreateMutate).toHaveBeenCalledWith(
			expect.objectContaining({ content: "Quick idea text" }),
			expect.anything(),
		);

		act(() => {
			vi.advanceTimersByTime(500);
		});

		expect(useLayoutStore.getState().globalNewModal.isOpen).toBe(false);
		expect(toast.success).not.toHaveBeenCalled();
	});

	it("Daily Diaryモード時にtextareaが break-words を保持し transform-gpu を含まないこと", () => {
		useLayoutStore.getState().openGlobalNewModal("diary");

		renderWithProviders(<GlobalNewNoteDialog />);

		const textarea = screen.getByPlaceholderText(/Write down your thoughts/i);
		expect(textarea).toBeInTheDocument();
		expect(textarea.className).toContain("break-words");
		expect(textarea.className).not.toContain("transform-gpu");
		expect(textarea.className).not.toContain("[overflow-wrap:anywhere]");
	});
});
