"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Diary } from "@sitecue/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useDeleteNotes, useUpdateNote } from "@/hooks/useNotesQuery";
import type { Draft, GroupedNotes, Note } from "../types";
import { MiddlePaneContent } from "./MiddlePaneContent";
import { type FilterType, MiddlePaneHeader } from "./MiddlePaneHeader";
import { NotesTabBar } from "./NotesTabBar";

type Props = {
	items: (Note | Draft | Diary)[];
	groupedNotes: GroupedNotes;
	currentView: string | null;
	currentDomain: string | null;
	currentExact: string | null;
	selectedNoteId: string | null;
	selectedDraftId: string | null;
	isLoading?: boolean;
};

export function MiddlePaneList(props: Props) {
	const {
		items,
		groupedNotes,
		currentView,
		currentDomain,
		currentExact,
		selectedNoteId,
		selectedDraftId,
		isLoading = false,
	} = props;

	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();

	const currentYear = searchParams.get("year");
	const currentMonth = searchParams.get("month");
	const currentQuery = searchParams.get("q") || "";

	const [inputValue, setInputValue] = useState(currentQuery);
	const query = inputValue.toLowerCase().trim();

	const [localItems, setLocalItems] = useState<(Note | Draft | Diary)[]>(items);
	const [prevItems, setPrevItems] = useState<(Note | Draft | Diary)[]>(items);

	if (items !== prevItems) {
		const validItems = items.filter(
			(item) => item && ("id" in item || "date" in item),
		);
		const uniqueItems = validItems.filter(
			(item, index, self) =>
				index ===
				self.findIndex((t) => {
					if ("id" in t && "id" in item) return t.id === item.id;
					if ("date" in t && "date" in item) return t.date === item.date;
					return false;
				}),
		);
		setPrevItems(items);
		setLocalItems(uniqueItems);
	}

	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [isDeletingBulk, setIsDeletingBulk] = useState(false);
	const [isSelectMode, setIsSelectMode] = useState(false);
	const [showResolved, setShowResolved] = useState(false);
	const [filterType, setFilterType] = useState<FilterType>("all");
	const [isSorting, setIsSorting] = useState(false);

	const isDesktop = useMediaQuery("(min-width: 768px)");
	const defaultBatchSize = isDesktop ? 35 : 20;
	const [visibleCount, setVisibleCount] = useState(defaultBatchSize);

	const scrollRef = useRef<HTMLDivElement>(null);

	const { mutateAsync: updateNote } = useUpdateNote();
	const { mutateAsync: deleteNotesAsync } = useDeleteNotes();

	const handleLoadMore = useCallback(() => {
		setVisibleCount((prev) => prev + defaultBatchSize);
	}, [defaultBatchSize]);

	// 階層コンテキストを正規化して検知（inbox / drafts / diaries / domain:exact）
	const resolvedContext = useMemo(() => {
		if (currentView === "inbox" || currentDomain === "inbox") {
			return "inbox";
		}
		if (currentView === "drafts") return "drafts";
		if (currentView === "diaries") return "diaries";
		if (currentDomain) return `${currentDomain}:${currentExact || "root"}`;
		return "domains-root";
	}, [currentView, currentDomain, currentExact]);

	const prevContextRef = useRef(resolvedContext);
	useEffect(() => {
		if (prevContextRef.current !== resolvedContext) {
			setIsSelectMode(false);
			setSelectedIds(new Set());
			setFilterType("all");
			setVisibleCount(defaultBatchSize);
			prevContextRef.current = resolvedContext;
		}
	}, [resolvedContext, defaultBatchSize]);

	const handleTabSwitch = useCallback(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = 0;
		}
	}, []);

	const handleBack = useCallback(() => {
		const params = new URLSearchParams(searchParams.toString());
		if (currentView === "diaries") {
			if (params.has("month")) {
				params.delete("month");
			} else if (params.has("year")) {
				params.delete("year");
			}
		} else {
			if (currentExact) {
				params.delete("exact");
			} else if (currentDomain) {
				params.delete("domain");
				params.set("view", "domains");
			}
		}
		router.replace(`${pathname}?${params.toString()}`, { scroll: false });
	}, [
		currentView,
		currentExact,
		currentDomain,
		searchParams,
		router,
		pathname,
	]);

	const handleDrilldown = useCallback(
		(e: React.MouseEvent, href: string) => {
			e.preventDefault();
			router.replace(href, { scroll: false });
		},
		[router],
	);

	const updateParams = useCallback(
		(key: string, value: string) => {
			const params = new URLSearchParams(searchParams.toString());
			if (value) params.set(key, value);
			else params.delete(key);
			router.replace(`${pathname}?${params.toString()}`, { scroll: false });
		},
		[searchParams, router, pathname],
	);

	const handleTodoToggle = useCallback(
		(e: React.MouseEvent, noteId: string, currentResolved: boolean) => {
			e.preventDefault();
			e.stopPropagation();
			void updateNote({
				id: noteId,
				updates: { is_resolved: !currentResolved },
			});
		},
		[updateNote],
	);

	// 🚨 Pin留め操作時のスクロール位置維持
	const handlePinToggle = useCallback(
		(e: React.MouseEvent, noteId: string, currentPinned: boolean) => {
			e.preventDefault();
			e.stopPropagation();

			const currentScrollTop = scrollRef.current?.scrollTop;

			void updateNote({
				id: noteId,
				updates: { is_pinned: !currentPinned },
			}).then(() => {
				if (scrollRef.current && currentScrollTop !== undefined) {
					requestAnimationFrame(() => {
						if (scrollRef.current) {
							scrollRef.current.scrollTop = currentScrollTop;
						}
					});
				}
			});
		},
		[updateNote],
	);

	const toggleSelect = useCallback((id: string, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	}, []);

	const handleCancelSelection = useCallback(() => {
		setSelectedIds(new Set());
	}, []);

	const handleDeleteSelected = useCallback(async () => {
		if (selectedIds.size === 0) return;
		const idsToDelete = Array.from(selectedIds);
		setIsDeletingBulk(true);

		setLocalItems((prev) =>
			prev.filter((item) => {
				if ("id" in item) return !selectedIds.has(item.id);
				return true;
			}),
		);
		setSelectedIds(new Set());
		setIsSelectMode(false);

		try {
			await deleteNotesAsync(idsToDelete);
		} catch (err) {
			console.error("Failed to delete selected notes:", err);
			toast.error("Failed to delete selected notes.");
			setLocalItems(items);
		} finally {
			setIsDeletingBulk(false);
		}
	}, [selectedIds, deleteNotesAsync, items]);

	const handleDragEnd = useCallback(
		async (event: DragEndEvent) => {
			const { active, over } = event;
			if (!over || isSorting || currentExact === "all") return;

			const activeItem = localItems.find(
				(item) => "id" in item && item.id === active.id,
			) as Note | undefined;
			const overItem = localItems.find(
				(item) => "id" in item && item.id === over.id,
			) as Note | undefined;

			if (!activeItem || !overItem) return;

			// 🚨 Pin留めノートと通常ノートの境界を跨ぐ移動を禁止（Pinソート順序の破綻防止）
			if (Boolean(activeItem.is_pinned) !== Boolean(overItem.is_pinned)) {
				return;
			}

			const oldIndex = localItems.findIndex(
				(item) => "id" in item && item.id === active.id,
			);
			const newIndex = localItems.findIndex(
				(item) => "id" in item && item.id === over.id,
			);

			if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

			const updatedItems = arrayMove(localItems, oldIndex, newIndex);
			const movedIndex = updatedItems.findIndex(
				(item) => "id" in item && item.id === active.id,
			);

			if (movedIndex === -1) return;

			let newOrder: number;
			const OFFSET = 0.0001;
			const EPSILON = 1e-9;

			if (movedIndex === 0) {
				const nextOrder = (updatedItems[1] as Note)?.sort_order ?? 0;
				newOrder = nextOrder - 1.0;
			} else if (movedIndex === updatedItems.length - 1) {
				const prevOrder =
					(updatedItems[movedIndex - 1] as Note)?.sort_order ?? 0;
				newOrder = prevOrder + 1.0;
			} else {
				const prevOrder =
					(updatedItems[movedIndex - 1] as Note)?.sort_order ?? 0;
				const nextOrder =
					(updatedItems[movedIndex + 1] as Note)?.sort_order ?? 0;

				if (Math.abs(prevOrder - nextOrder) < EPSILON) {
					if (oldIndex > newIndex) {
						newOrder = nextOrder - OFFSET;
					} else {
						newOrder = prevOrder + OFFSET;
					}
				} else {
					newOrder = (prevOrder + nextOrder) / 2.0;
				}
			}

			const targetItem = updatedItems[movedIndex];
			if (targetItem && "sort_order" in targetItem) {
				(targetItem as Note).sort_order = newOrder;
			}
			setLocalItems(updatedItems);

			setIsSorting(true);
			try {
				await updateNote({
					id: String(active.id),
					updates: { sort_order: newOrder },
				});
				router.refresh();
			} catch (error) {
				console.error("Failed to update note order:", error);
				setLocalItems(items);
			} finally {
				setIsSorting(false);
			}
		},
		[localItems, isSorting, currentExact, updateNote, router, items],
	);

	const displayItems = localItems.filter((item): item is Note | Draft => {
		const isDiary = "date" in item && !("note_type" in item);
		if (isDiary) return false;

		const isNote = "note_type" in item;
		if (isNote && item.is_resolved && !showResolved) return false;

		if (filterType !== "all") {
			if (!isNote || item.note_type !== filterType) return false;
		}

		return true;
	});

	const searchedDisplayItems = displayItems.filter((item) => {
		if (!query) return true;
		const contentMatch =
			"content" in item && item.content?.toLowerCase().includes(query);
		const titleMatch =
			"title" in item && item.title?.toLowerCase().includes(query);
		const tagsMatch =
			"tags" in item && item.tags?.some((t) => t.toLowerCase().includes(query));
		return contentMatch || titleMatch || tagsMatch;
	});

	const isSearchActive = !!inputValue || !!searchParams.get("tags");

	return (
		<div className="flex flex-col h-full bg-base-bg md:border-r md:border-base-border md:w-96">
			{/* Morphing Header Container (1段目〜4段目) */}
			<div className="flex-shrink-0 p-4 space-y-3 border-b border-base-border bg-base-bg">
				{/* 1段目: タブナビゲーション */}
				<NotesTabBar currentView={currentView} onTabSwitch={handleTabSwitch} />

				{/* 2〜4段目: 操作ヘッダー */}
				<MiddlePaneHeader
					currentView={currentView}
					currentDomain={currentDomain}
					currentExact={currentExact}
					currentYear={currentYear}
					currentMonth={currentMonth}
					inputValue={inputValue}
					onInputChange={setInputValue}
					filterType={filterType}
					onFilterTypeChange={setFilterType}
					showResolved={showResolved}
					onShowResolvedChange={setShowResolved}
					isSelectMode={isSelectMode}
					onSelectModeChange={setIsSelectMode}
					selectedCount={selectedIds.size}
					onCancelSelection={handleCancelSelection}
					onDeleteSelected={handleDeleteSelected}
					isDeletingBulk={isDeletingBulk}
					displayItems={searchedDisplayItems}
					onBack={handleBack}
				/>
			</div>

			{/* 下部リスト描画領域 */}
			<MiddlePaneContent
				items={localItems}
				searchedDisplayItems={searchedDisplayItems}
				groupedNotes={groupedNotes}
				currentView={currentView}
				currentDomain={currentDomain}
				currentExact={currentExact}
				currentYear={currentYear}
				currentMonth={currentMonth}
				query={query}
				isSearchActive={isSearchActive}
				selectedNoteId={selectedNoteId}
				selectedDraftId={selectedDraftId}
				isSelectMode={isSelectMode}
				selectedIds={selectedIds}
				onSelectChange={toggleSelect}
				onTodoToggle={handleTodoToggle}
				onPinToggle={handlePinToggle}
				onDragEnd={handleDragEnd}
				onDrilldown={handleDrilldown}
				onUpdateParams={updateParams}
				scrollRef={scrollRef}
				isLoading={isLoading}
				visibleCount={visibleCount}
				onLoadMore={handleLoadMore}
			/>
		</div>
	);
}
