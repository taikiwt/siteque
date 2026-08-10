"use client";

import type { Draft, Note, Template } from "@sitecue/shared";
import { APP_LIMITS, extractTags } from "@sitecue/shared";
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
	Panel,
	Group as PanelGroup,
	Separator as PanelResizeHandle,
} from "react-resizable-panels";
import TextareaAutosize from "react-textarea-autosize";
import { StudioEditor } from "@/components/editor/StudioEditor";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { InlineCopyButton } from "@/components/ui/inline-copy-button";
import { SWRBoundary } from "@/components/ui/swr-boundary";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useDraftHistory } from "@/hooks/useDraftHistory";
import {
	useCreateDraft,
	useDeleteDraft,
	useFetchDraft,
	useUpdateDraft,
} from "@/hooks/useDraftsQuery";
import { useDeleteNotes, useUpsertNotes } from "@/hooks/useNotesQuery";
import { useStudioAI } from "@/hooks/useStudioAI";
import { useFetchTemplates } from "@/hooks/useTemplatesQuery";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/useEditorStore";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useUserStore } from "@/store/useUserStore";
import { createClient } from "@/utils/supabase/client";
import { DraftEditorHeader } from "../studio/_components/DraftEditorHeader";
import StudioMaterialsPane from "../studio/_components/StudioMaterialsPane";
import StudioReviewPane from "../studio/_components/StudioReviewPane";
import { StudioEditorSkeleton } from "../studio/_components/StudioSkeletons";
import { SaveAsTemplateDialog } from "./SaveAsTemplateDialog";

type NoteType = "info" | "alert" | "idea";

interface DraftEditorProps {
	draftId?: string;
	templateId?: string;
	initialDraft?: Draft;
	template?: Template | null;
}

export default function DraftEditor({
	draftId,
	templateId,
	initialDraft,
	template,
}: DraftEditorProps) {
	const { data: fetchedDraft, isLoading: isDraftLoading } = useFetchDraft(
		draftId,
		initialDraft,
	);
	const activeDraft = fetchedDraft || initialDraft;

	const searchParams = useSearchParams();
	const effectiveTemplateId =
		templateId ?? searchParams.get("template_id") ?? undefined;
	const { data: templates } = useFetchTemplates();
	const fetchedTemplate = effectiveTemplateId
		? templates?.find((t) => t.id === effectiveTemplateId)
		: null;

	const [selectedTemplate, setSelectedTemplate] = useState<
		Template | null | undefined
	>(template);
	const activeTemplate =
		selectedTemplate ?? (fetchedTemplate || activeDraft?.sitecue_templates);
	const isSidebarOpen = useLayoutStore((state) => state.isSidebarOpen);
	const router = useRouter();
	const supabase = createClient();
	const initialPane =
		searchParams.get("tab") === "materials" ? "materials" : "review";
	const [activePane, setActivePane] = useState<"review" | "materials">(
		initialPane,
	);
	const [isPanelOpen, setIsPanelOpen] = useState(false);

	const togglePanel = () => {
		setIsPanelOpen(!isPanelOpen);
	};
	const isDesktop = useMediaQuery("(min-width: 768px)");
	const isLargeDesktop = useMediaQuery("(min-width: 1024px)");
	const isTabletPortrait = useMediaQuery(
		"(min-width: 768px) and (max-width: 1023px)",
	);
	const _isMobile = useMediaQuery("(max-width: 767px)");
	const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

	const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
		"idle",
	);
	const [isSaveTemplateDialogOpen, setIsSaveTemplateDialogOpen] =
		useState(false);
	const [savedState, setSavedState] = useState({
		content: activeDraft?.content || activeTemplate?.boilerplate || "",
		title: activeDraft?.title || "",
		slug: (activeDraft?.metadata?.slug as string) || "",
	});
	const [content, setContent] = useState(savedState.content);
	const [title, setTitle] = useState(savedState.title);
	const [slug, setSlug] = useState(savedState.slug);

	useEffect(() => {
		if (activeDraft || activeTemplate) {
			const initialContent =
				activeDraft?.content || activeTemplate?.boilerplate || "";
			const initialTitle = activeDraft?.title || "";
			const initialSlug = (activeDraft?.metadata?.slug as string) || "";

			setSavedState({
				content: initialContent,
				title: initialTitle,
				slug: initialSlug,
			});
			setContent((prev) => (!prev ? initialContent : prev));
			setTitle((prev) => (!prev ? initialTitle : prev));
			setSlug((prev) => (!prev ? initialSlug : prev));
		}
	}, [activeDraft, activeTemplate]);

	const [hasUnsavedNotesChanges, setHasUnsavedNotesChanges] = useState(false);

	// State for Self Review
	const [reviewNotes, setReviewNotes] = useState<Note[]>([]);
	const [isLoadingReview, setIsLoadingReview] = useState(true);
	const [deletedNoteIds, setDeletedNoteIds] = useState<string[]>([]);

	// State for Global Materials
	const [searchKeyword, setSearchKeyword] = useState("");
	const [searchResults, setSearchResults] = useState<Note[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	const openPaywall = useUserStore((state) => state.openPaywall);
	const pendingContent = useEditorStore((state) => state.pendingContent);
	const setPendingContent = useEditorStore((state) => state.setPendingContent);

	const targetDraftId = draftId || activeDraft?.id;

	// Custom Hooks
	const {
		historyIndex,
		historyLength,
		pushToHistory,
		handleUndo: undoHistory,
		handleRedo: redoHistory,
	} = useDraftHistory(
		activeDraft?.content || activeTemplate?.boilerplate || "",
	);

	const {
		isWeaving,
		isGeneratingReview,
		generateWeave,
		generateReview,
		generateHint,
	} = useStudioAI();

	const createDraftMutation = useCreateDraft();
	const updateDraftMutation = useUpdateDraft();
	const deleteDraftMutation = useDeleteDraft();
	const upsertNotesMutation = useUpsertNotes();
	const deleteNotesMutation = useDeleteNotes();

	const isDirty =
		content !== savedState.content ||
		title !== savedState.title ||
		slug !== savedState.slug ||
		hasUnsavedNotesChanges;

	const handleDeleteDraft = async () => {
		if (!targetDraftId) return;
		if (!window.confirm("Are you sure you want to delete this draft?")) return;
		try {
			await deleteDraftMutation.mutateAsync(targetDraftId);
			router.push("/");
			router.refresh();
		} catch (err) {
			console.error("Failed to delete draft:", err);
			toast.error("Failed to delete draft.");
		}
	};

	const _handleBack = () => {
		// 履歴が十分に存在する場合はブラウザバック、それ以外はNotesビューのDraftsタブへフォールバック
		if (window.history.length > 2) {
			router.back();
		} else {
			router.push("/notes?view=drafts");
		}
	};

	// Fetch notes for Self Review (based on draft_id)
	useEffect(() => {
		if (!targetDraftId) {
			setIsLoadingReview(false);
			return;
		}

		const fetchReviewNotes = async () => {
			try {
				const { data, error } = await supabase
					.from("sitecue_notes")
					.select("*")
					.eq("draft_id", targetDraftId)
					.order("created_at", { ascending: false });

				if (error) throw error;
				if (data) {
					setReviewNotes(data as Note[]);
				}
			} catch (error) {
				console.error("Failed to fetch review notes:", error);
			} finally {
				setIsLoadingReview(false);
			}
		};

		fetchReviewNotes();
	}, [supabase, targetDraftId]);

	// Initialize state from pending content if available
	useEffect(() => {
		if (pendingContent) {
			setContent(pendingContent);
			setSavedState((prev) => ({ ...prev, content: pendingContent }));
			pushToHistory(pendingContent);
			setPendingContent(null);
		}
	}, [pendingContent, pushToHistory, setPendingContent]);

	// Initialize state from profile if needed (handled by AppShell/Store)

	const handleUndo = useCallback(() => {
		const previousContent = undoHistory();
		if (previousContent !== null) setContent(previousContent);
	}, [undoHistory]);

	const handleRedo = useCallback(() => {
		const previousContent = redoHistory();
		if (previousContent !== null) setContent(previousContent);
	}, [redoHistory]);

	const handleSearch = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (!searchKeyword.trim()) return;

		setIsSearching(true);
		try {
			const { data, error } = await supabase
				.from("sitecue_notes")
				.select("*")
				.is("draft_id", null)
				.or(
					`content.ilike.%${searchKeyword}%,url_pattern.ilike.%${searchKeyword}%`,
				)
				.order("created_at", { ascending: false });

			if (error) throw error;
			setSearchResults((data as Note[]) || []);
		} catch (error) {
			console.error("Failed to search materials:", error);
		} finally {
			setIsSearching(false);
		}
	};

	const handleAddNote = async (content: string, type: NoteType) => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) throw new Error("User not authenticated");

			// Always keep in-memory for both New and Existing drafts (In-Memory First Pattern)
			const now = new Date().toISOString();
			const tempNote: Note = {
				id: crypto.randomUUID(),
				content,
				note_type: type,
				draft_id: targetDraftId || null,
				scope: "draft",
				url_pattern: targetDraftId ? `sitecue://draft/${targetDraftId}` : "",
				user_id: user.id,
				created_at: now,
				updated_at: now,
				is_expanded: false,
				is_favorite: false,
				is_pinned: false,
				is_resolved: false,
				sort_order: reviewNotes.length,
				tags: null,
			};
			setReviewNotes((prev) => [tempNote, ...prev]);
			setHasUnsavedNotesChanges(true);
		} catch (error) {
			console.error("Failed to add note:", error);
			throw error;
		}
	};

	const handleUpdateNote = (id: string, newContent: string) => {
		setReviewNotes((prev) =>
			prev.map((n) => (n.id === id ? { ...n, content: newContent } : n)),
		);
		setHasUnsavedNotesChanges(true);
	};

	const handleUpdateNoteType = (id: string, newType: NoteType) => {
		setReviewNotes((prev) =>
			prev.map((n) => (n.id === id ? { ...n, note_type: newType } : n)),
		);
		setHasUnsavedNotesChanges(true);
	};

	const handleToggleNoteResolved = (id: string) => {
		setReviewNotes((prev) =>
			prev.map((n) =>
				n.id === id ? { ...n, is_resolved: !n.is_resolved } : n,
			),
		);
		setHasUnsavedNotesChanges(true);
	};

	const handleDeleteNote = (id: string) => {
		const noteToDelete = reviewNotes.find((n) => n.id === id);
		if (noteToDelete?.draft_id) {
			setDeletedNoteIds((prev) => [...prev, id]);
		}
		setReviewNotes((prev) => prev.filter((n) => n.id !== id));
		setHasUnsavedNotesChanges(true);
	};

	const handleDeleteAllNotes = () => {
		const dbNotesIds = reviewNotes.filter((n) => n.draft_id).map((n) => n.id);
		if (dbNotesIds.length > 0) {
			setDeletedNoteIds((prev) => [...prev, ...dbNotesIds]);
		}
		setReviewNotes([]);
		setHasUnsavedNotesChanges(true);
	};

	const handleReorderNotes = (newOrder: Note[]) => {
		setReviewNotes(newOrder);
		setHasUnsavedNotesChanges(true);
	};

	const handleInsertToEditor = (noteContent: string) => {
		const newContent = content ? `${content}\n\n${noteContent}` : noteContent;
		setContent(newContent);
		pushToHistory(newContent);
	};

	const handleWeave = async () => {
		if (isWeaving) return;

		// Save current state before weave
		pushToHistory(content);

		// 未解決のノート（!is_resolved）のみを Weave の対象とする
		const activeReviewNotes = reviewNotes.filter((n) => !n.is_resolved);

		const { newContent, planError, error } = await generateWeave(
			content,
			activeReviewNotes,
			activeTemplate,
		);

		if (planError) {
			openPaywall("ai");
			return;
		}

		if (error) {
			return;
		}

		if (newContent) {
			setContent(newContent);
			pushToHistory(newContent);

			// Auto-Consume only active review notes used in Weave
			const noteIdsToDelete = activeReviewNotes.map((note) => note.id);
			if (noteIdsToDelete.length > 0) {
				deleteNotesMutation.mutate(noteIdsToDelete);
			}
			setReviewNotes((prev) => prev.filter((n) => n.is_resolved));
		}
	};

	const handleGenerateReview = async () => {
		if (isGeneratingReview) return;

		const { newNotes, planError, error } = await generateReview(
			content,
			targetDraftId,
		);

		if (planError) {
			openPaywall("ai");
			return;
		}

		if (error) {
			return;
		}

		if (newNotes) {
			setReviewNotes((prev) => [...newNotes, ...prev]);
			setHasUnsavedNotesChanges(true);
		}
	};

	const handleGenerateHint = async (
		contextText: string,
		isExplicit: boolean = false,
	): Promise<string | null> => {
		return generateHint(contextText, isExplicit);
	};

	const charCount = content.length;
	const templateLimit = activeTemplate?.max_length;
	const absoluteLimit = APP_LIMITS.MAX_DRAFT_LENGTH;
	const effectiveLimit = templateLimit ?? absoluteLimit;

	const isNearLimit = charCount >= effectiveLimit * 0.9;
	const isOverLimit = charCount > effectiveLimit;

	const handleSave = async () => {
		if (isOverLimit) return;
		setStatus("saving");
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("Not authenticated");

			const metadata =
				activeTemplate?.name === "Zenn"
					? { slug }
					: activeDraft?.metadata || {};

			const extractedTags = extractTags(content);
			let currentDraftId = targetDraftId;

			let savedDraftData: Draft;

			if (currentDraftId) {
				savedDraftData = await updateDraftMutation.mutateAsync({
					id: currentDraftId,
					updates: {
						title,
						content,
						template_id: activeTemplate?.id || null,
						metadata,
						tags: extractedTags,
						updated_at: new Date().toISOString(),
					},
				});
			} else {
				savedDraftData = await createDraftMutation.mutateAsync({
					title,
					content,
					template_id: activeTemplate?.id || null,
					metadata,
					tags: extractedTags,
					updated_at: new Date().toISOString(),
				});
				currentDraftId = savedDraftData.id;
			}

			if (currentDraftId) {
				// 1. Handle Deletions
				if (deletedNoteIds.length > 0) {
					await deleteNotesMutation.mutateAsync(deletedNoteIds);
				}

				// 2. Handle Upserts (Additions & Updates)
				if (reviewNotes.length >= 0) {
					// biome-ignore lint/suspicious/noExplicitAny: Supabase upsert payload
					const notesToUpsert: any[] = reviewNotes.map((n, index) => ({
						id: n.id,
						content: n.content,
						note_type: n.note_type,
						draft_id: currentDraftId,
						scope: n.scope,
						url_pattern: n.draft_id
							? n.url_pattern
							: `sitecue://draft/${currentDraftId}`,
						user_id: user.id,
						sort_order: index,
						is_expanded: n.is_expanded || false,
						is_favorite: n.is_favorite || false,
						is_pinned: n.is_pinned || false,
						is_resolved: n.is_resolved || false,
					}));

					if (notesToUpsert.length > 0) {
						await upsertNotesMutation.mutateAsync(notesToUpsert);
					}
				}

				setDeletedNoteIds([]);
				setSavedState({ content, title, slug });
				setHasUnsavedNotesChanges(false);

				if (!draftId) {
					router.replace(`/studio/${currentDraftId}`, { scroll: false });
				}
			}

			setStatus("success");
			setTimeout(() => {
				setStatus("idle");
			}, 2000);
		} catch (err: unknown) {
			console.error("Failed to save draft:", err);
			const errorMessage =
				err instanceof Error
					? err.message.toLowerCase()
					: typeof err === "object" && err !== null && "message" in err
						? String((err as { message: unknown }).message).toLowerCase()
						: String(err).toLowerCase();

			if (errorMessage.includes("limit reached")) {
				openPaywall(errorMessage.includes("draft") ? "drafts" : "notes");
			} else {
				toast.error("Failed to save the draft.");
			}
			setStatus("error");
		}
	};

	const updatePane = (pane: "review" | "materials") => {
		setActivePane(pane);
		setIsPanelOpen(true);
		// Passive URL sync without trigger router re-render
		const params = new URLSearchParams(window.location.search);
		params.set("tab", pane);
		window.history.replaceState(null, "", `?${params.toString()}`);
	};

	const handleTemplateSaved = async (newTemplate: Template) => {
		setSelectedTemplate(newTemplate);
		setIsSaveTemplateDialogOpen(false);
		// If draft is already saved in DB, update its template_id immediately
		if (targetDraftId) {
			await updateDraftMutation.mutateAsync({
				id: targetDraftId,
				updates: { template_id: newTemplate.id },
			});
		}
	};

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
						className="flex h-full flex-col overflow-hidden border-r border-base-border bg-base-bg"
						defaultSize="65%"
						minSize="30%"
					>
						<DraftEditorHeader
							isSidebarOpen={isSidebarOpen}
							canUndo={historyIndex > 0}
							canRedo={historyIndex < historyLength - 1}
							onUndo={handleUndo}
							onRedo={handleRedo}
							onSave={handleSave}
							status={status}
							hasDraftId={!!targetDraftId}
							onSaveAsTemplate={() => setIsSaveTemplateDialogOpen(true)}
							onDeleteDraft={handleDeleteDraft}
							isOverLimit={isOverLimit}
							backHref="/notes?view=drafts"
						/>

						<div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-10">
							<div className="relative max-w-4xl mx-auto w-full flex flex-col gap-8">
								{/* Metadata & Title Area */}
								<div className="flex flex-col gap-4">
									<div className="grid gap-4">
										<div className="flex items-start gap-2 group/title">
											<TextareaAutosize
												placeholder={
													activeTemplate?.name === "Zenn"
														? "Enter article title..."
														: "Title (optional)"
												}
												value={title}
												onChange={(e) => setTitle(e.target.value)}
												className="w-full bg-transparent text-3xl md:text-4xl font-extrabold placeholder:text-neutral-300 focus:outline-none resize-none leading-tight"
											/>
											<InlineCopyButton
												text={title}
												className="mt-2 opacity-100 md:opacity-0 md:group-hover/title:opacity-100 transition-opacity"
											/>
										</div>
										{activeTemplate?.name === "Zenn" && (
											<div className="flex items-center gap-2 text-sm text-neutral-400 group/slug">
												<span>slug:</span>
												<input
													type="text"
													placeholder="example-article-slug"
													value={slug}
													onChange={(e) => setSlug(e.target.value)}
													className="flex-1 bg-transparent font-mono focus:outline-none"
												/>
												<InlineCopyButton
													text={slug}
													className="opacity-100 md:opacity-0 md:group-hover/slug:opacity-100 transition-opacity"
												/>
											</div>
										)}
									</div>
								</div>

								{/* Editor Area */}
								<div className="relative w-full pb-32">
									<div className="absolute top-4 right-4 z-10">
										<InlineCopyButton
											text={content}
											className="bg-white/80 backdrop-blur shadow-sm border border-neutral-100"
										/>
									</div>
									<Suspense
										fallback={
											<StudioEditorSkeleton hasDraftId={!!targetDraftId} />
										}
									>
										<SWRBoundary
											data={draftId ? activeDraft : activeTemplate || content}
											isLoading={!!draftId && isDraftLoading && !activeDraft}
											fallback={
												<StudioEditorSkeleton hasDraftId={!!targetDraftId} />
											}
										>
											{() => (
												<StudioEditor
													value={content}
													onChange={(val) => setContent(val)}
													placeholder="Write down your thoughts..."
													isDirty={isDirty}
													onGenerateHint={handleGenerateHint}
												/>
											)}
										</SWRBoundary>
									</Suspense>
									<div className="flex justify-between items-center pt-2 text-[10px] font-mono font-bold text-neutral-400">
										<span className="text-sm font-medium text-neutral-500 uppercase tracking-widest">
											{activeTemplate
												? `Template: ${activeTemplate.name}`
												: "Blank Canvas"}
										</span>
										{isNearLimit ? (
											<span
												className={cn(
													isOverLimit ? "text-note-alert" : "text-note-idea",
												)}
											>
												{charCount.toLocaleString()} /{" "}
												{effectiveLimit.toLocaleString()} chars
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
						<header className="border-b border-base-border p-2">
							<div className="flex rounded-full bg-base-surface p-1">
								<button
									type="button"
									onClick={() => updatePane("review")}
									className={cn(
										"flex-1 rounded-full py-1.5 text-xs font-bold transition-all cursor-pointer",
										activePane === "review"
											? "bg-action text-action-text shadow-sm"
											: "text-neutral-500 hover-safe:text-action",
									)}
								>
									SELF REVIEW
								</button>
								<button
									type="button"
									onClick={() => updatePane("materials")}
									className={cn(
										"flex-1 rounded-full py-1.5 text-xs font-bold transition-all cursor-pointer",
										activePane === "materials"
											? "bg-action text-action-text shadow-sm"
											: "text-neutral-500 hover-safe:text-action",
									)}
								>
									GLOBAL MATERIALS
								</button>
							</div>
						</header>

						{/* Tab Content */}
						<div className="flex-1 overflow-hidden">
							{activePane === "review" ? (
								<StudioReviewPane
									reviewNotes={reviewNotes}
									isLoadingReview={isLoadingReview}
									onAddNote={handleAddNote}
									onUpdateNote={handleUpdateNote}
									onUpdateNoteType={handleUpdateNoteType}
									onToggleNoteResolved={handleToggleNoteResolved}
									onDeleteNote={handleDeleteNote}
									onDeleteAllNotes={handleDeleteAllNotes}
									onReorderNotes={handleReorderNotes}
									onInsertToEditor={handleInsertToEditor}
									onWeave={handleWeave}
									isWeaving={isWeaving}
									onGenerateReview={handleGenerateReview}
									isGeneratingReview={isGeneratingReview}
								/>
							) : (
								<StudioMaterialsPane
									searchKeyword={searchKeyword}
									onSearchKeywordChange={setSearchKeyword}
									onSearch={handleSearch}
									searchResults={searchResults}
									isSearching={isSearching}
								/>
							)}
						</div>

						<div className="border-t border-base-border p-4 text-center bg-base-bg/50">
							<p className="text-[10px] text-neutral-400 font-medium">
								Weave Studio Power User Mode
							</p>
						</div>
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
					{/* 左ペイン: メインエディタ */}
					<div
						className={cn(
							"h-full flex flex-col transition-all duration-300 ease-in-out overflow-hidden min-w-0 bg-base-bg",
							isTabletPortrait && isPanelOpen
								? "w-1/2 border-r border-base-border"
								: "w-full",
						)}
					>
						<DraftEditorHeader
							isSidebarOpen={isSidebarOpen}
							canUndo={historyIndex > 0}
							canRedo={historyIndex < historyLength - 1}
							onUndo={handleUndo}
							onRedo={handleRedo}
							onSave={handleSave}
							status={status}
							hasDraftId={!!targetDraftId}
							onSaveAsTemplate={() => setIsSaveTemplateDialogOpen(true)}
							onDeleteDraft={handleDeleteDraft}
							isOverLimit={isOverLimit}
							backHref="/notes?view=drafts"
						/>

						<div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-10">
							<div className="relative max-w-4xl mx-auto w-full flex flex-col gap-8">
								{/* Metadata & Title Area */}
								<div className="flex flex-col gap-4">
									<div className="grid gap-4">
										<div className="flex items-start gap-2 group/title">
											<TextareaAutosize
												placeholder={
													activeTemplate?.name === "Zenn"
														? "Enter article title..."
														: "Title (optional)"
												}
												value={title}
												onChange={(e) => setTitle(e.target.value)}
												className="w-full bg-transparent text-3xl md:text-4xl font-extrabold placeholder:text-neutral-300 focus:outline-none resize-none leading-tight"
											/>
											<InlineCopyButton
												text={title}
												className="mt-2 opacity-100 md:opacity-0 md:group-hover/title:opacity-100 transition-opacity"
											/>
										</div>
										{activeTemplate?.name === "Zenn" && (
											<div className="flex items-center gap-2 text-sm text-neutral-400 group/slug">
												<span>slug:</span>
												<input
													type="text"
													placeholder="example-article-slug"
													value={slug}
													onChange={(e) => setSlug(e.target.value)}
													className="flex-1 bg-transparent font-mono focus:outline-none"
												/>
												<InlineCopyButton
													text={slug}
													className="opacity-100 md:opacity-0 md:group-hover/slug:opacity-100 transition-opacity"
												/>
											</div>
										)}
									</div>
								</div>

								{/* Editor Area */}
								<div className="relative w-full pb-32">
									<div className="absolute top-4 right-4 z-10">
										<InlineCopyButton
											text={content}
											className="bg-white/80 backdrop-blur shadow-sm border border-neutral-100"
										/>
									</div>
									<Suspense
										fallback={
											<StudioEditorSkeleton hasDraftId={!!targetDraftId} />
										}
									>
										<SWRBoundary
											data={draftId ? activeDraft : activeTemplate || content}
											isLoading={!!draftId && isDraftLoading && !activeDraft}
											fallback={
												<StudioEditorSkeleton hasDraftId={!!targetDraftId} />
											}
										>
											{() => (
												<StudioEditor
													value={content}
													onChange={(val) => setContent(val)}
													placeholder="Write down your thoughts..."
													isDirty={isDirty}
													onGenerateHint={handleGenerateHint}
												/>
											)}
										</SWRBoundary>
									</Suspense>
									<div className="flex justify-between items-center pt-2 text-[10px] font-mono font-bold text-neutral-400">
										<span className="text-sm font-medium text-neutral-500 uppercase tracking-widest">
											{activeTemplate
												? `Template: ${activeTemplate.name}`
												: "Blank Canvas"}
										</span>
										{isNearLimit ? (
											<span
												className={cn(
													isOverLimit ? "text-note-alert" : "text-note-idea",
												)}
											>
												{charCount.toLocaleString()} /{" "}
												{effectiveLimit.toLocaleString()} chars
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

					{/* 右ペイン (Tablet width = 50%, hidden on mobile via isTabletPortrait wrap) */}
					{isTabletPortrait && (
						<div
							className={cn(
								"h-full bg-base-surface transition-all duration-300 ease-in-out flex flex-col overflow-hidden shrink-0",
								isPanelOpen ? "w-1/2" : "w-0 opacity-0 pointer-events-none",
							)}
						>
							<header className="border-b border-base-border p-2">
								<div className="flex rounded-full bg-base-surface p-1">
									<button
										type="button"
										onClick={() => updatePane("review")}
										className={cn(
											"flex-1 rounded-full py-1.5 text-xs font-bold transition-all cursor-pointer",
											activePane === "review"
												? "bg-action text-action-text shadow-sm"
												: "text-neutral-500 hover-safe:text-action",
										)}
									>
										SELF REVIEW
									</button>
									<button
										type="button"
										onClick={() => updatePane("materials")}
										className={cn(
											"flex-1 rounded-full py-1.5 text-xs font-bold transition-all cursor-pointer",
											activePane === "materials"
												? "bg-action text-action-text shadow-sm"
												: "text-neutral-500 hover-safe:text-action",
										)}
									>
										GLOBAL MATERIALS
									</button>
								</div>
							</header>

							{/* Tab Content */}
							<div className="flex-1 overflow-hidden">
								{activePane === "review" ? (
									<StudioReviewPane
										reviewNotes={reviewNotes}
										isLoadingReview={isLoadingReview}
										onAddNote={handleAddNote}
										onUpdateNote={handleUpdateNote}
										onUpdateNoteType={handleUpdateNoteType}
										onToggleNoteResolved={handleToggleNoteResolved}
										onDeleteNote={handleDeleteNote}
										onDeleteAllNotes={handleDeleteAllNotes}
										onReorderNotes={handleReorderNotes}
										onInsertToEditor={handleInsertToEditor}
										onWeave={handleWeave}
										isWeaving={isWeaving}
										onGenerateReview={handleGenerateReview}
										isGeneratingReview={isGeneratingReview}
									/>
								) : (
									<StudioMaterialsPane
										searchKeyword={searchKeyword}
										onSearchKeywordChange={setSearchKeyword}
										onSearch={handleSearch}
										searchResults={searchResults}
										isSearching={isSearching}
									/>
								)}
							</div>

							<div className="border-t border-base-border p-4 text-center bg-base-bg/50">
								<p className="text-[10px] text-neutral-400 font-medium">
									Weave Studio Power User Mode
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Floating Mobile Trigger */}
				{!isDesktop && (
					<div className="fixed bottom-6 right-6 z-50">
						<Drawer
							open={isMobileDrawerOpen}
							onOpenChange={setIsMobileDrawerOpen}
						>
							<DrawerTrigger asChild>
								<button
									type="button"
									className="flex h-14 items-center justify-center gap-2 rounded-full bg-action px-6 text-action-text shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer"
								>
									<Sparkles className="h-5 w-5" aria-hidden="true" />
									<span className="text-sm font-bold">Notes & AI</span>
								</button>
							</DrawerTrigger>
							<DrawerContent className="!mt-0 !h-[100dvh] !max-h-none rounded-t-2xl rounded-b-none p-0 flex flex-col overflow-hidden bg-base-bg border-none">
								<DrawerHeader className="sr-only">
									<DrawerTitle>Weave Studio</DrawerTitle>
									<DrawerDescription>
										Access AI Weave and Materials
									</DrawerDescription>
								</DrawerHeader>

								{/* Mobile Header with Back Button */}
								<div className="shrink-0 flex flex-col px-4 pt-2 pb-3 border-b border-base-border mt-2 bg-base-bg">
									<div className="flex items-center mb-3">
										<Button
											onClick={() => setIsMobileDrawerOpen(false)}
											type="button"
											variant="ghost"
											className="gap-2 px-2 -ml-2 text-action hover-safe:bg-base-surface cursor-pointer"
										>
											<ArrowLeft aria-hidden="true" className="w-5 h-5" />
											Editor
										</Button>
									</div>
									{/* Tab Navigation */}
									<div className="flex rounded-full bg-base-surface p-1">
										<button
											type="button"
											onClick={() => updatePane("review")}
											className={cn(
												"flex-1 rounded-full py-1.5 text-xs font-bold transition-all cursor-pointer",
												activePane === "review"
													? "bg-action text-action-text shadow-sm"
													: "text-neutral-500 hover-safe:text-action",
											)}
										>
											SELF REVIEW
										</button>
										<button
											type="button"
											onClick={() => updatePane("materials")}
											className={cn(
												"flex-1 rounded-full py-1.5 text-xs font-bold transition-all cursor-pointer",
												activePane === "materials"
													? "bg-action text-action-text shadow-sm"
													: "text-neutral-500 hover-safe:text-action",
											)}
										>
											GLOBAL MATERIALS
										</button>
									</div>
								</div>

								<div className="flex-1 overflow-hidden">
									{activePane === "review" ? (
										<StudioReviewPane
											reviewNotes={reviewNotes}
											isLoadingReview={isLoadingReview}
											onAddNote={handleAddNote}
											onUpdateNote={handleUpdateNote}
											onUpdateNoteType={handleUpdateNoteType}
											onToggleNoteResolved={handleToggleNoteResolved}
											onDeleteNote={handleDeleteNote}
											onDeleteAllNotes={handleDeleteAllNotes}
											onReorderNotes={handleReorderNotes}
											onInsertToEditor={handleInsertToEditor}
											onWeave={handleWeave}
											isWeaving={isWeaving}
											onGenerateReview={handleGenerateReview}
											isGeneratingReview={isGeneratingReview}
										/>
									) : (
										<StudioMaterialsPane
											searchKeyword={searchKeyword}
											onSearchKeywordChange={setSearchKeyword}
											onSearch={handleSearch}
											searchResults={searchResults}
											isSearching={isSearching}
										/>
									)}
								</div>
							</DrawerContent>
						</Drawer>
					</div>
				)}
			</div>

			<SaveAsTemplateDialog
				isOpen={isSaveTemplateDialogOpen}
				onOpenChange={setIsSaveTemplateDialogOpen}
				initialTitle={title}
				initialContent={content}
				onSuccess={handleTemplateSaved}
			/>
		</div>
	);
}
