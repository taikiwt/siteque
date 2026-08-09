"use client";

import { type Diary, SHARED_LIMITS } from "@sitecue/shared";
import {
	ArrowLeft,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
	Panel,
	Group as PanelGroup,
	Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { StudioEditor } from "@/components/editor/StudioEditor";
import { Button } from "@/components/ui/button";
import { CustomLink } from "@/components/ui/custom-link";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { SWRBoundary } from "@/components/ui/swr-boundary";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useFetchDiaryByDate, useUpdateDiary } from "@/hooks/useDiariesQuery";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useUserStore } from "@/store/useUserStore";
import { DiaryMaterialsPane } from "./DiaryMaterialsPane";

interface Props {
	initialDiary?: Diary | null;
	date: string;
}

export function DiaryStudioClient({ initialDiary, date }: Props) {
	const { data: fetchedDiary, isLoading: isDiaryLoading } = useFetchDiaryByDate(
		date,
		initialDiary,
	);
	const activeDiary = fetchedDiary ?? initialDiary ?? null;

	const router = useRouter();
	const { plan, openPaywall } = useUserStore();
	const [isPanelOpen, setIsPanelOpen] = useState(false);

	const togglePanel = () => {
		setIsPanelOpen(!isPanelOpen);
	};

	const _isSidebarOpen = useLayoutStore((state) => state.isSidebarOpen);
	const isDesktop = useMediaQuery("(min-width: 768px)");
	const isLargeDesktop = useMediaQuery("(min-width: 1024px)");
	const isTabletPortrait = useMediaQuery(
		"(min-width: 768px) and (max-width: 1023px)",
	);
	const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
	const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
		"idle",
	);

	const [savedContent, setSavedContent] = useState(activeDiary?.content || "");
	const [savedTopics, setSavedTopics] = useState<string[]>(
		activeDiary?.topics || [],
	);

	const [content, setContent] = useState(savedContent);
	const [topics, setTopics] = useState<string[]>(savedTopics);

	useEffect(() => {
		if (activeDiary) {
			setSavedContent(activeDiary.content || "");
			setSavedTopics(activeDiary.topics || []);
			setContent((prev) => (!prev ? activeDiary.content || "" : prev));
			setTopics((prev) =>
				prev.length === 0 ? activeDiary.topics || [] : prev,
			);
		}
	}, [activeDiary]);

	const [newTopic, setNewTopic] = useState("");
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [editingText, setEditingText] = useState("");

	const handleStartEdit = (index: number, text: string) => {
		setEditingIndex(index);
		setEditingText(text);
	};

	const handleSaveEdit = (index: number) => {
		const trimmed = editingText.trim();
		if (!trimmed) {
			handleRemoveTopic(index);
			return;
		}
		if (trimmed.length > 50) {
			alert("Topic length cannot exceed 50 characters");
			return;
		}
		const updated = [...topics];
		updated[index] = trimmed;
		setTopics(updated);
		setEditingIndex(null);
	};
	const updateDiaryMutation = useUpdateDiary();

	const isDirty =
		content !== savedContent ||
		JSON.stringify(topics) !== JSON.stringify(savedTopics);

	const handleAddTopic = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = newTopic.trim();
		if (!trimmed) return;
		if (trimmed.length > 50) {
			alert("Topic length cannot exceed 50 characters");
			return;
		}
		if (topics.length >= 10) {
			alert("Maximum 10 topics allowed");
			return;
		}
		if (!topics.includes(trimmed)) {
			setTopics([...topics, trimmed]);
		}
		setNewTopic("");
	};

	const handleRemoveTopic = (indexToRemove: number) => {
		setTopics(topics.filter((_, i) => i !== indexToRemove));
	};

	const handleSave = async () => {
		if (isOverLimit) return;
		setStatus("saving");
		try {
			await updateDiaryMutation.mutateAsync({ date, text: content, topics });
			setSavedContent(content);
			setSavedTopics(topics);
			setStatus("success");
			setTimeout(() => setStatus("idle"), 2000);
		} catch (err: unknown) {
			console.error("Failed to save diary:", err);
			const errorMessage =
				err instanceof Error
					? err.message.toLowerCase()
					: typeof err === "object" && err !== null && "message" in err
						? String((err as { message: unknown }).message).toLowerCase()
						: String(err).toLowerCase();

			if (
				errorMessage.includes("limit reached") ||
				errorMessage.includes("exceeds")
			) {
				openPaywall("notes");
			} else {
				toast.error("Failed to save diary log.");
			}
			setStatus("error");
		}
	};

	const _handleBack = () => {
		if (window.history.length > 2) router.back();
		else router.push("/notes?view=diaries");
	};

	const handleInsertMaterial = (text: string) => {
		setContent((prev) => (prev ? `${prev}\n\n${text}` : text));
	};

	const charCount = content.length;
	const maxDiaryLimit =
		plan === "pro"
			? SHARED_LIMITS.DIARY_LENGTH.PRO
			: SHARED_LIMITS.DIARY_LENGTH.FREE;
	const isNearLimit = charCount >= maxDiaryLimit * 0.9;
	const isOverLimit = charCount > maxDiaryLimit;

	return (
		<div className="flex-1 h-full w-full flex flex-col min-h-0 relative">
			{/* PC Layout (1024px+): useMediaQuery + CSS helper guard */}
			<div
				className={cn(
					"w-full h-full min-h-0 hidden lg:flex",
					isLargeDesktop ? "flex" : "hidden",
				)}
			>
				<PanelGroup
					className="flex-1 w-full h-full overflow-hidden bg-base-bg text-action"
					orientation="horizontal"
				>
					<Panel
						className="flex h-full flex-col overflow-hidden border-r border-base-border bg-base-bg min-w-0"
						defaultSize="65%"
						minSize="30%"
					>
						<header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-base-border bg-base-surface/50 h-14">
							<div className="flex items-center gap-3">
								<CustomLink
									href="/notes?view=diaries"
									className="text-gray-400 hover:text-action cursor-pointer inline-flex items-center justify-center p-2 rounded-md hover:bg-neutral-100 transition-colors"
								>
									<ArrowLeft className="w-4 h-4" />
								</CustomLink>
								<div className="flex flex-col">
									<h1 className="text-sm font-bold tracking-tight text-action">
										Diary Studio
									</h1>
									<span className="text-[10px] font-mono text-gray-400 font-bold">
										{date}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button
									className="shadow-sm font-bold min-w-[80px] cursor-pointer"
									disabled={status === "saving" || !isDirty || isOverLimit}
									onClick={handleSave}
									size="sm"
									variant="default"
								>
									{status === "saving"
										? "Saving..."
										: status === "success"
											? "Saved"
											: "Save Diary"}
								</Button>
							</div>
						</header>

						<div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-10 bg-base-bg min-w-0">
							<div className="relative max-w-4xl mx-auto w-full flex flex-col gap-6 min-w-0">
								<div className="text-xs font-medium text-neutral-400 uppercase tracking-widest font-mono">
									Canvas: Daily Sandbox
								</div>

								{/* Topics Section */}
								<div className="flex flex-col gap-3 w-full border border-base-border bg-base-surface/30 p-4 rounded-xl mb-4">
									<span className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-wider">
										Key Events of the Day ({topics.length}/10)
									</span>
									<div className="flex flex-col gap-2 w-full">
										{topics.map((topic, index) => (
											<div
												key={topic}
												className="w-full rounded-full bg-base-surface border border-base-border text-xs px-4 py-1.5 flex items-center justify-between text-neutral-700 font-medium min-h-[36px]"
											>
												{editingIndex === index ? (
													<input
														type="text"
														value={editingText}
														onChange={(e) => setEditingText(e.target.value)}
														onBlur={() => handleSaveEdit(index)}
														onKeyDown={(e) => {
															if (e.key === "Enter") {
																if (e.nativeEvent.isComposing) return;
																e.preventDefault();
																handleSaveEdit(index);
															}
															if (e.key === "Escape") {
																setEditingIndex(null);
															}
														}}
														className="flex-1 bg-transparent focus:outline-none text-xs text-neutral-900 font-semibold"
														// biome-ignore lint/a11y/noAutofocus: Focus input immediately on start editing
														autoFocus
														maxLength={50}
													/>
												) : (
													// biome-ignore lint/a11y/noStaticElementInteractions: Click span to start editing topic
													// biome-ignore lint/a11y/useKeyWithClickEvents: Trigger edit mode via click
													<span
														className="truncate pr-4 flex-1 cursor-pointer hover:text-action transition-colors"
														onClick={() => handleStartEdit(index, topic)}
														title="Click to edit topic"
													>
														{topic}
													</span>
												)}

												<div className="flex items-center gap-1.5 shrink-0">
													{editingIndex !== index && (
														<button
															type="button"
															onClick={() => handleRemoveTopic(index)}
															className="text-neutral-400 hover:text-note-alert p-1 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
															aria-label="Remove topic"
														>
															<X className="w-3 h-3" aria-hidden="true" />
														</button>
													)}
												</div>
											</div>
										))}
									</div>
									{topics.length < 10 && (
										<form
											onSubmit={handleAddTopic}
											className="flex items-center gap-2 mt-1"
										>
											<input
												type="text"
												value={newTopic}
												onChange={(e) => setNewTopic(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter" && e.nativeEvent.isComposing) {
														e.stopPropagation();
													}
												}}
												placeholder="+ Add key event of the day... (Max 50 chars)"
												className="flex-1 bg-transparent border-b border-dashed border-neutral-300 focus:border-action focus:outline-none text-xs py-1 px-1 text-neutral-600"
												maxLength={50}
											/>
											<Button
												type="submit"
												size="sm"
												variant="ghost"
												className="text-[10px] uppercase font-mono tracking-wider font-bold h-7 rounded-full"
											>
												Add
											</Button>
										</form>
									)}
								</div>

								<div className="relative w-full text-base md:text-sm min-w-0">
									<Suspense
										fallback={
											<div className="h-64 animate-pulse rounded-xl bg-neutral-100/50 border border-neutral-200" />
										}
									>
										<SWRBoundary
											data={activeDiary}
											isLoading={isDiaryLoading && !activeDiary}
											fallback={
												<div className="h-64 animate-pulse rounded-xl bg-neutral-100/50 border border-neutral-200" />
											}
										>
											{() => (
												<StudioEditor
													onChange={(val) => setContent(val)}
													value={content}
													placeholder="Write down your thoughts for today... (Markdown supported)"
													isDirty={isDirty}
													onGenerateHint={async () => null}
												/>
											)}
										</SWRBoundary>
									</Suspense>
									<div className="flex justify-end pt-2 text-[10px] font-mono font-bold text-neutral-400">
										{isNearLimit ? (
											<span
												className={cn(
													isOverLimit ? "text-note-alert" : "text-note-idea",
												)}
											>
												{charCount.toLocaleString()} /{" "}
												{maxDiaryLimit.toLocaleString()} chars
											</span>
										) : (
											<span>{charCount.toLocaleString()} chars</span>
										)}
									</div>
								</div>
							</div>
						</div>
					</Panel>
					<PanelResizeHandle className="w-1 bg-transparent hover:bg-neutral-200 active:bg-neutral-300 transition-colors cursor-col-resize" />
					<Panel
						className="flex h-full flex-col overflow-hidden bg-base-surface border-l border-base-border"
						defaultSize="35%"
						maxSize="50%"
						minSize="20%"
					>
						<DiaryMaterialsPane date={date} onInsert={handleInsertMaterial} />
					</Panel>
				</PanelGroup>
			</div>

			{/* Mobile/Tablet Layout (<1024px): useMediaQuery + CSS helper guard */}
			<div
				className={cn(
					"w-full h-full min-h-0 lg:hidden",
					!isLargeDesktop ? "flex flex-col" : "hidden",
				)}
			>
				<div className="flex-grow w-full h-full flex relative overflow-hidden bg-base-bg text-action">
					<div
						className={cn(
							"h-full flex flex-col transition-all duration-300 ease-in-out overflow-hidden min-w-0 bg-base-bg",
							isTabletPortrait && isPanelOpen
								? "w-1/2 border-r border-base-border"
								: "w-full",
						)}
					>
						<header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-base-border bg-base-surface/50 h-14">
							<div className="flex items-center gap-3">
								<CustomLink
									href="/notes?view=diaries"
									className="text-gray-400 hover:text-action cursor-pointer inline-flex items-center justify-center p-2 rounded-md hover:bg-neutral-100 transition-colors"
								>
									<ArrowLeft className="w-4 h-4" />
								</CustomLink>
								<div className="flex flex-col">
									<h1 className="text-sm font-bold tracking-tight text-action">
										Diary Studio
									</h1>
									<span className="text-[10px] font-mono text-gray-400 font-bold">
										{date}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button
									className="shadow-sm font-bold min-w-[80px] cursor-pointer"
									disabled={status === "saving" || !isDirty || isOverLimit}
									onClick={handleSave}
									size="sm"
									variant="default"
								>
									{status === "saving"
										? "Saving..."
										: status === "success"
											? "Saved"
											: "Save Diary"}
								</Button>
							</div>
						</header>

						<div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-10 bg-base-bg min-w-0">
							<div className="relative max-w-4xl mx-auto w-full flex flex-col gap-6 min-w-0">
								<div className="text-xs font-medium text-neutral-400 uppercase tracking-widest font-mono">
									Canvas: Daily Sandbox
								</div>

								{/* Topics Section */}
								<div className="flex flex-col gap-3 w-full border border-base-border bg-base-surface/30 p-4 rounded-xl mb-4">
									<span className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-wider">
										Key Events of the Day ({topics.length}/10)
									</span>
									<div className="flex flex-col gap-2 w-full">
										{topics.map((topic, index) => (
											<div
												key={topic}
												className="w-full rounded-full bg-base-surface border border-base-border text-xs px-4 py-1.5 flex items-center justify-between text-neutral-700 font-medium min-h-[36px]"
											>
												{editingIndex === index ? (
													<input
														type="text"
														value={editingText}
														onChange={(e) => setEditingText(e.target.value)}
														onBlur={() => handleSaveEdit(index)}
														onKeyDown={(e) => {
															if (e.key === "Enter") {
																if (e.nativeEvent.isComposing) return;
																e.preventDefault();
																handleSaveEdit(index);
															}
															if (e.key === "Escape") {
																setEditingIndex(null);
															}
														}}
														className="flex-1 bg-transparent focus:outline-none text-xs text-neutral-900 font-semibold"
														// biome-ignore lint/a11y/noAutofocus: Focus input immediately on start editing
														autoFocus
														maxLength={50}
													/>
												) : (
													// biome-ignore lint/a11y/noStaticElementInteractions: Click span to start editing topic
													// biome-ignore lint/a11y/useKeyWithClickEvents: Trigger edit mode via click
													<span
														className="truncate pr-4 flex-1 cursor-pointer hover:text-action transition-colors"
														onClick={() => handleStartEdit(index, topic)}
														title="Click to edit topic"
													>
														{topic}
													</span>
												)}

												<div className="flex items-center gap-1.5 shrink-0">
													{editingIndex !== index && (
														<button
															type="button"
															onClick={() => handleRemoveTopic(index)}
															className="text-neutral-400 hover:text-note-alert p-1 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
															aria-label="Remove topic"
														>
															<X className="w-3 h-3" aria-hidden="true" />
														</button>
													)}
												</div>
											</div>
										))}
									</div>
									{topics.length < 10 && (
										<form
											onSubmit={handleAddTopic}
											className="flex items-center gap-2 mt-1"
										>
											<input
												type="text"
												value={newTopic}
												onChange={(e) => setNewTopic(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter" && e.nativeEvent.isComposing) {
														e.stopPropagation();
													}
												}}
												placeholder="+ Add key event of the day... (Max 50 chars)"
												className="flex-1 bg-transparent border-b border-dashed border-neutral-300 focus:border-action focus:outline-none text-xs py-1 px-1 text-neutral-600"
												maxLength={50}
											/>
											<Button
												type="submit"
												size="sm"
												variant="ghost"
												className="text-[10px] uppercase font-mono tracking-wider font-bold h-7 rounded-full"
											>
												Add
											</Button>
										</form>
									)}
								</div>

								<div className="relative w-full text-base md:text-sm min-w-0">
									<Suspense
										fallback={
											<div className="h-64 animate-pulse rounded-xl bg-neutral-100/50 border border-neutral-200" />
										}
									>
										<SWRBoundary
											data={activeDiary}
											isLoading={isDiaryLoading && !activeDiary}
											fallback={
												<div className="h-64 animate-pulse rounded-xl bg-neutral-100/50 border border-neutral-200" />
											}
										>
											{() => (
												<StudioEditor
													onChange={(val) => setContent(val)}
													value={content}
													placeholder="Write down your thoughts for today... (Markdown supported)"
													isDirty={isDirty}
													onGenerateHint={async () => null}
												/>
											)}
										</SWRBoundary>
									</Suspense>
									<div className="flex justify-end pt-2 text-[10px] font-mono font-bold text-neutral-400">
										{isNearLimit ? (
											<span
												className={cn(
													isOverLimit ? "text-note-alert" : "text-note-idea",
												)}
											>
												{charCount.toLocaleString()} /{" "}
												{maxDiaryLimit.toLocaleString()} chars
											</span>
										) : (
											<span>{charCount.toLocaleString()} chars</span>
										)}
									</div>
								</div>
							</div>
						</div>
					</div>

					{isTabletPortrait &&
						(isPanelOpen ? (
							/* 展開時：邪魔にならないよう文字を排除し、アイコン単体の物理的正円（size-10）を死守 */
							<button
								type="button"
								onClick={togglePanel}
								className="fixed right-[50%] -mr-5 top-1/2 -translate-y-1/2 z-40 size-10 rounded-full bg-base-surface border border-base-border shadow-md text-neutral-400 hover:text-action transition-all flex items-center justify-center select-none cursor-pointer active:bg-action active:text-action-text active:border-action"
								title="Close right panel"
							>
								<ChevronRight className="w-5 h-5 shrink-0" aria-hidden="true" />
							</button>
						) : (
							/* 閉鎖時：横幅を w-[80px] に拡張、フォントサイズを text-xs (12px) に引き上げて視認性を最大化 */
							<button
								type="button"
								onClick={togglePanel}
								className="fixed right-0 top-1/2 -translate-y-1/2 z-40 w-[80px] h-[160px] rounded-l-full bg-base-surface border border-base-border border-r-0 shadow-md text-neutral-400 hover:text-action transition-all flex items-center justify-center gap-1 pl-2 select-none cursor-pointer group/knob active:bg-action active:text-action-text active:border-action"
								title="Open right panel"
							>
								<ChevronLeft
									className="w-5 h-5 shrink-0 transition-transform group-hover/knob:-translate-x-0.5"
									aria-hidden="true"
								/>
								<div className="flex flex-col text-left font-mono text-xs font-black uppercase tracking-tight leading-none text-neutral-500 group-active:text-action-text">
									<span>Open</span>
									<span>Panel</span>
								</div>
							</button>
						))}

					{/* 右側パネル: iPad縦持ちで開いている場合のみ幅50% */}
					{isTabletPortrait && (
						<div
							className={cn(
								"h-full bg-base-surface transition-all duration-300 ease-in-out flex flex-col overflow-hidden shrink-0",
								isPanelOpen ? "w-1/2" : "w-0 opacity-0 pointer-events-none",
							)}
						>
							<div className="flex-1 overflow-hidden">
								<DiaryMaterialsPane
									date={date}
									onInsert={handleInsertMaterial}
								/>
							</div>
						</div>
					)}
				</div>

				{/* Floating Mobile Trigger */}
				{!isDesktop && (
					<div className="fixed bottom-6 right-6 z-50">
						<Drawer
							onOpenChange={setIsMobileDrawerOpen}
							open={isMobileDrawerOpen}
						>
							<DrawerTrigger asChild>
								<button
									type="button"
									className="flex h-12 items-center justify-center gap-2 rounded-full bg-action px-5 text-action-text shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer"
								>
									<CalendarDays aria-hidden="true" className="h-4 w-4" />
									<span className="text-xs font-bold font-mono uppercase tracking-wide">
										Materials
									</span>
								</button>
							</DrawerTrigger>
							<DrawerContent className="!mt-0 !h-[100dvh] !max-h-none rounded-t-2xl rounded-b-none p-0 flex flex-col overflow-hidden bg-base-bg border-none">
								<DrawerHeader className="sr-only">
									<DrawerTitle>Materials Timeline</DrawerTitle>
									<DrawerDescription>
										Review your footprints for today
									</DrawerDescription>
								</DrawerHeader>
								<div className="shrink-0 flex items-center px-4 h-14 border-b border-base-border bg-base-bg">
									<Button
										onClick={() => setIsMobileDrawerOpen(false)}
										type="button"
										variant="ghost"
										className="gap-2 px-2 -ml-2 text-action cursor-pointer text-xs font-bold"
									>
										<ArrowLeft aria-hidden="true" className="w-4 h-4" />
										Editor Workspace
									</Button>
								</div>
								<div className="flex-1 overflow-hidden">
									<DiaryMaterialsPane
										date={date}
										onInsert={handleInsertMaterial}
									/>
								</div>
							</DrawerContent>
						</Drawer>
					</div>
				)}
			</div>
		</div>
	);
}
