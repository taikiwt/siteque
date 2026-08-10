"use client";

import type {
	CreateNoteInput,
	Note,
	ViewScope as NoteScope,
} from "@sitecue/shared";
import { APP_LIMITS } from "@sitecue/shared";
import { CalendarDays, Inbox, PenTool } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { NotesEditor } from "@/components/editor/NotesEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppendDiary } from "@/hooks/useDiariesQuery";
import { useMarkdownAssist } from "@/hooks/useMarkdownAssist";
import { useCreateNote } from "@/hooks/useNotesQuery";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/useEditorStore";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useUserStore } from "@/store/useUserStore";

export function GlobalNewNoteDialog() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const { globalNewModal, openGlobalNewModal, closeGlobalNewModal } =
		useLayoutStore();
	const isOpen = globalNewModal.isOpen;
	const mode = globalNewModal.mode;

	const setMode = (targetMode: "gate" | "note" | "diary") => {
		useLayoutStore.setState((state) => ({
			globalNewModal: { ...state.globalNewModal, mode: targetMode },
		}));
	};

	const [content, setContent] = useState("");
	const [urlPattern, setUrlPattern] = useState("");
	const [scope, setScope] = useState<NoteScope>("inbox");
	const [noteType, setNoteType] = useState<Note["note_type"]>("info");
	const [isSubmittingAnimation, setIsSubmittingAnimation] = useState(false);

	const diaryTextareaRef = useRef<HTMLTextAreaElement>(null);

	const createNoteMutation = useCreateNote();
	const appendDiaryMutation = useAppendDiary();
	const openPaywall = useUserStore((state) => state.openPaywall);
	const setPendingContent = useEditorStore((state) => state.setPendingContent);

	const { onKeyDown: onMarkdownKeyDown, onPaste: onMarkdownPaste } =
		useMarkdownAssist();

	const charCount = content.length;
	const isNearLimit = charCount >= APP_LIMITS.MAX_NOTE_LENGTH * 0.9;
	const isOverLimit = charCount > APP_LIMITS.MAX_NOTE_LENGTH;

	useEffect(() => {
		const globalNewParam = searchParams.get("globalNew");
		const intentParam = searchParams.get("intent");

		if ((globalNewParam === "note" || globalNewParam === "diary") && !isOpen) {
			let targetMode: "gate" | "note" | "diary" = "gate";
			if (globalNewParam === "diary" || intentParam === "diary") {
				targetMode = "diary";
			} else if (intentParam === "note") {
				targetMode = "note";
			}

			openGlobalNewModal(targetMode);

			let currentExact = searchParams.get("exact");
			let currentDomain = searchParams.get("domain");
			if (currentExact === "all") currentExact = null;
			if (currentDomain === "all") currentDomain = "inbox";

			if (currentExact) {
				setUrlPattern(currentExact);
				setScope("exact");
			} else if (currentDomain && currentDomain !== "inbox") {
				setUrlPattern(currentDomain);
				setScope("domain");
			} else {
				setUrlPattern("");
				setScope("inbox");
			}

			const params = new URLSearchParams(searchParams.toString());
			params.delete("globalNew");
			params.delete("intent");
			const cleanQuery = params.toString();
			router.replace(
				`${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`,
			);
		}
	}, [searchParams, router, openGlobalNewModal, isOpen]);

	// 開いた時のみ入力クリア＆アニメーションフラグ安全初期化
	useEffect(() => {
		if (isOpen) {
			setContent("");
			setNoteType("info");
			setIsSubmittingAnimation(false);
		}
	}, [isOpen]);

	const isUrlRequired = scope === "exact" || scope === "domain";
	const isUrlInvalid = isUrlRequired && !urlPattern.trim();
	const isSaveDisabled =
		!content.trim() ||
		isSubmittingAnimation ||
		(mode === "note" && (isOverLimit || isUrlInvalid));

	const handleOpenChange = (open: boolean) => {
		if (!open && !isSubmittingAnimation) {
			handleCancel();
		}
	};

	const handleCancel = () => {
		closeGlobalNewModal();
		setIsSubmittingAnimation(false);
	};

	const handleSave = () => {
		if (isSaveDisabled) return;

		const capturedContent = content.trim();
		const capturedScope = scope;
		const capturedNoteType = noteType;
		const capturedUrlPattern = urlPattern.trim();
		const currentMode = mode;

		// 1. フォーカス安全解除 ＆ 0ms即時右スライドアニメーション開始
		if (
			typeof document !== "undefined" &&
			document.activeElement instanceof HTMLElement
		) {
			document.activeElement.blur();
		}
		setIsSubmittingAnimation(true);

		// 2. 非同期通信をバックグラウンドへ流す
		if (currentMode === "diary") {
			const d = new Date();
			const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
			appendDiaryMutation.mutate(
				{
					date: todayStr,
					text: capturedContent,
				},
				{
					onError: (err: unknown) => {
						console.error("Failed to save diary via background pipeline:", err);
						toast.error("Failed to save diary log");
					},
				},
			);
		} else {
			const input: CreateNoteInput = {
				content: capturedContent,
				scope: capturedScope,
				note_type: capturedNoteType,
				currentUrl: capturedUrlPattern || "inbox",
			};

			createNoteMutation.mutate(input, {
				onError: (err: unknown) => {
					console.error("Failed to save note via background pipeline:", err);
					const errorMessage =
						err instanceof Error
							? err.message.toLowerCase()
							: typeof err === "object" && err !== null && "message" in err
								? String((err as { message: unknown }).message).toLowerCase()
								: String(err).toLowerCase();

					if (errorMessage.includes("limit reached")) {
						openPaywall("notes");
					} else {
						toast.error(
							`Failed to save. Retain: "${capturedContent.slice(0, 20)}..."`,
						);
					}
				},
			});
		}

		// 3. 右スライド(400ms) ＋ 余韻ポーズ(100ms) 後にモーダルを閉じる
		setTimeout(() => {
			closeGlobalNewModal();
		}, 500);
	};

	const handlePromoteToStudio = () => {
		setPendingContent(content);
		handleCancel();
		router.push(
			mode === "diary"
				? `/diaries/${new Date().toISOString().split("T")[0]}`
				: "/studio/new",
		);
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className={cn(
					"bg-base-surface flex flex-col max-h-[85vh] overflow-hidden p-0",
					mode === "gate" ? "sm:max-w-md" : "sm:max-w-2xl",
					isSubmittingAnimation && "pointer-events-none",
				)}
			>
				<DialogTitle className="sr-only">Capture Menu</DialogTitle>

				{mode === "gate" && (
					<div className="p-6 space-y-4">
						<h2 className="text-base font-bold text-action text-center uppercase tracking-wide mb-2">
							What would you like to capture?
						</h2>
						<div className="flex flex-col w-full gap-3">
							<button
								type="button"
								onClick={() => setMode("note")}
								className="flex items-center gap-4 w-full p-4 rounded-full border border-base-border bg-base-bg hover-safe:bg-base-surface text-left cursor-pointer transition-all group px-6"
							>
								<Inbox className="w-5 h-5 text-gray-400 group-hover-safe:text-action shrink-0" />
								<div className="flex flex-col min-w-0">
									<span className="text-sm font-bold text-action">
										Quick Note
									</span>
									<span className="text-xs text-gray-400 truncate">
										Capture an instantaneous text linked to context
									</span>
								</div>
							</button>

							<button
								type="button"
								onClick={() => {
									handleCancel();
									router.push("/studio/new");
								}}
								className="flex items-center gap-4 w-full p-4 rounded-full border border-base-border bg-base-bg hover-safe:bg-base-surface text-left cursor-pointer transition-all group px-6"
							>
								<PenTool className="w-5 h-5 text-gray-400 group-hover-safe:text-action shrink-0" />
								<div className="flex flex-col min-w-0">
									<span className="text-sm font-bold text-action">
										Blank Draft
									</span>
									<span className="text-xs text-gray-400 truncate">
										Open full-pane studio to author a heavy document
									</span>
								</div>
							</button>

							<button
								type="button"
								onClick={() => setMode("diary")}
								className="flex items-center gap-4 w-full p-4 rounded-full border border-base-border bg-base-bg hover-safe:bg-base-surface text-left cursor-pointer transition-all group px-6"
							>
								<CalendarDays className="w-5 h-5 text-gray-400 group-hover-safe:text-action shrink-0" />
								<div className="flex flex-col min-w-0">
									<span className="text-sm font-bold text-action">
										Daily Diary
									</span>
									<span className="text-xs text-gray-400 truncate">
										Atomic titleless log appending to today's timeline
									</span>
								</div>
							</button>
						</div>
					</div>
				)}

				{mode === "diary" && (
					<div className="flex flex-col flex-1 p-6 space-y-4 min-h-0">
						<div className="flex items-center gap-2 shrink-0">
							<span className="text-xs font-mono font-bold uppercase text-neutral-400">
								Daily Diary Mode
							</span>
						</div>
						{/* ★ 縦幅を min-h-[380px] h-[50vh] flex-1 に拡大し、枠内どこでもクリックで textarea にフォーカス委譲 */}
						{/* biome-ignore lint/a11y/useKeyWithClickEvents: focus delegation to inner textarea */}
						{/* biome-ignore lint/a11y/noStaticElementInteractions: focus delegation to inner textarea */}
						<div
							onClick={() => diaryTextareaRef.current?.focus()}
							className="w-full flex-1 min-h-[380px] h-[50vh] bg-base-bg border border-base-border rounded-xl focus-within:ring-1 focus-within:ring-action overflow-hidden relative p-4 cursor-text flex flex-col"
						>
							<textarea
								ref={diaryTextareaRef}
								autoFocus
								value={content}
								onChange={(e) => setContent(e.target.value)}
								onPaste={onMarkdownPaste}
								placeholder="Write down your thoughts for today... (No title required)"
								className={cn(
									"w-full flex-1 h-full text-base bg-transparent text-action border-none focus:outline-none resize-none font-sans break-words p-0 overflow-y-auto block",
									isSubmittingAnimation
										? "transition-all duration-400 ease-out translate-x-full opacity-0 pointer-events-none"
										: "transition-none",
								)}
								onKeyDown={(e) => {
									if (e.nativeEvent.isComposing) return;
									if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
										e.preventDefault();
										handleSave();
										return;
									}
									onMarkdownKeyDown(e);
								}}
							/>
						</div>
						<div className="flex items-center justify-between mt-2 shrink-0">
							<Button
								className="text-xs text-neutral-400 hover-safe:text-action p-0 h-auto"
								onClick={handlePromoteToStudio}
								type="button"
								variant="link"
							>
								Edit in Diary Studio
							</Button>
							<div className="flex gap-2">
								<Button
									disabled={isSubmittingAnimation}
									onClick={handleCancel}
									type="button"
									variant="ghost"
								>
									Cancel
								</Button>
								<Button
									className="min-w-[100px] rounded-full"
									disabled={isSaveDisabled}
									onClick={handleSave}
									type="button"
									variant="default"
								>
									{isSubmittingAnimation ? "Logging..." : "Save Diary"}
								</Button>
							</div>
						</div>
					</div>
				)}

				{mode === "note" && (
					<>
						<div className="p-6 space-y-6 flex-1 overflow-y-auto">
							<div className="flex items-center gap-2">
								<span className="text-xs font-mono font-bold uppercase text-neutral-400">
									Quick Note Mode
								</span>
							</div>

							<div className="space-y-4">
								<div className="space-y-2">
									<Label className="font-xs font-bold uppercase tracking-wider text-gray-400 inline-block mb-2">
										Scope
									</Label>
									<div className="flex bg-base-bg p-1 rounded-full border border-base-border/50 shrink-0 gap-1 w-fit">
										{(["inbox", "domain", "exact"] as const).map((s) => (
											<button
												key={s}
												type="button"
												onClick={() => setScope(s)}
												className={cn(
													"cursor-pointer py-1.5 px-4 rounded-full text-xs font-bold transition-all capitalize",
													scope === s
														? "bg-action text-action-text shadow-sm"
														: "text-muted-foreground hover-safe:text-action hover-safe:bg-base-surface",
												)}
											>
												{s === "exact" ? "Page" : s}
											</button>
										))}
									</div>
								</div>

								{scope !== "inbox" && (
									<div className="space-y-2">
										<Label
											htmlFor="global-url"
											className="font-xs font-bold uppercase tracking-wider text-gray-400 inline-block mb-2"
										>
											Source URL
										</Label>
										<Input
											id="global-url"
											placeholder="[example.com/page](https://example.com/page)"
											value={urlPattern}
											onChange={(e) => setUrlPattern(e.target.value)}
											className="h-9 w-full rounded-full text-base md:text-sm px-4"
										/>
									</div>
								)}
							</div>

							<div className="grid items-center gap-2 mb-4">
								<Label className="font-xs font-bold uppercase tracking-wider text-gray-400 inline-block mb-2">
									Note Type
								</Label>
								<div className="flex bg-base-bg p-1 rounded-full border border-base-border/50 shrink-0 gap-1 w-fit">
									{(["info", "alert", "idea"] as const).map((type) => (
										<button
											key={type}
											type="button"
											onClick={() => setNoteType(type as Note["note_type"])}
											className={cn(
												"cursor-pointer py-1.5 px-4 rounded-full text-xs font-bold transition-all capitalize",
												noteType === type
													? type === "info"
														? "bg-note-info text-action-text shadow-sm"
														: type === "alert"
															? "bg-note-alert text-action-text shadow-sm"
															: "bg-note-idea text-action-text shadow-sm"
													: "text-muted-foreground hover-safe:text-action hover-safe:bg-base-surface",
											)}
										>
											{type}
										</button>
									))}
								</div>
							</div>

							<div className="space-y-2">
								<Label className="font-xs font-bold uppercase tracking-wider text-gray-400 inline-block mb-2">
									Note
								</Label>
								{/* 外枠を固定したマスク親コンテナ */}
								<div className="w-full overflow-hidden relative rounded-xl">
									<div
										className={cn(
											"w-full transform-gpu",
											isSubmittingAnimation
												? "transition-all duration-400 ease-out translate-x-full opacity-0 pointer-events-none"
												: "transition-none",
										)}
									>
										<NotesEditor
											value={content}
											onChange={setContent}
											placeholder="What's on your mind?"
											isDirty={content.length > 0}
											onSave={handleSave}
										/>
									</div>
								</div>
								{isNearLimit && (
									<div className="flex justify-end">
										<span
											className={cn(
												"text-[10px] font-bold",
												isOverLimit ? "text-note-alert" : "text-note-idea",
											)}
										>
											{charCount.toLocaleString()} /{" "}
											{APP_LIMITS.MAX_NOTE_LENGTH.toLocaleString()}
										</span>
									</div>
								)}
							</div>
						</div>

						<div className="m-0 p-4 bg-base-surface/50 border-t border-base-border flex justify-between w-full items-center">
							<Button
								className="mr-auto rounded-full"
								onClick={handlePromoteToStudio}
								type="button"
								variant="outline"
							>
								Edit in Studio
							</Button>
							<div className="flex gap-2">
								<Button
									disabled={isSubmittingAnimation}
									onClick={handleCancel}
									type="button"
									variant="ghost"
								>
									Cancel
								</Button>
								<Button
									className="min-w-[100px] rounded-full"
									disabled={isSaveDisabled}
									onClick={handleSave}
									type="button"
									variant="default"
								>
									{isSubmittingAnimation ? "Saving..." : "Save Note"}
								</Button>
							</div>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
