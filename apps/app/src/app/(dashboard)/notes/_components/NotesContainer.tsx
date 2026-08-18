"use client";

import type { Diary } from "@sitecue/shared";
import { getSafeUrl } from "@sitecue/shared";
import { useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useEffect, useMemo } from "react";
import { SWRBoundary } from "@/components/ui/swr-boundary";
import { useFetchDiaries } from "@/hooks/useDiariesQuery";
import { useFetchDrafts } from "@/hooks/useDraftsQuery";
import { useFetchNoteContents, useFetchNotes } from "@/hooks/useNotesQuery";
import { groupNotes } from "@/store/useNotesStore";
import type { Draft, Note, SearchParams } from "../types";
import { MiddlePaneList } from "./MiddlePaneList";
import {
	MiddlePaneListSkeleton,
	NotesContainerSkeleton,
	RightPaneSkeleton,
} from "./NotesSkeletons";
import { ResponsiveNotesLayout } from "./ResponsiveNotesLayout";
import { RightPaneDetail } from "./RightPaneDetail";

export { NotesContainerSkeleton };

export function NotesContainer() {
	const searchParams = useSearchParams();

	const { data: notes = [], isLoading: isNotesLoading } = useFetchNotes();
	const { data: drafts = [], isLoading: isDraftsLoading } = useFetchDrafts();
	const { data: diaries = [], isLoading: isDiariesLoading } = useFetchDiaries();
	const { mutate: fetchContentForIds } = useFetchNoteContents();

	const params: SearchParams = useMemo(() => {
		return {
			view: searchParams.get("view") as SearchParams["view"],
			domain: searchParams.get("domain") || undefined,
			exact: searchParams.get("exact") || undefined,
			noteId: searchParams.get("noteId") || undefined,
			draftId: searchParams.get("draftId") || undefined,
			new: searchParams.get("new") || undefined,
			q: searchParams.get("q") || undefined,
			tags: searchParams.get("tags") || undefined,
			year: searchParams.get("year") || undefined,
			month: searchParams.get("month") || undefined,
			date: searchParams.get("date") || undefined,
		};
	}, [searchParams]);

	const { domain, exact } = params;
	const isNewNote = params.new === "note";

	const effectiveView = useMemo(() => {
		const rawView = params.view as string | undefined;
		if (params.domain === "inbox") {
			return "inbox";
		}
		if (
			rawView &&
			["domains", "inbox", "drafts", "diaries"].includes(rawView)
		) {
			return rawView as SearchParams["view"] & string;
		}
		return "domains";
	}, [params.view, params.domain]);

	// ★ 入力値を useDeferredValue で遅延させ、重いフィルタ計算を低優先度タスクへ回す
	const deferredView = useDeferredValue(effectiveView);
	const deferredDomain = useDeferredValue(domain);
	const deferredExact = useDeferredValue(exact);
	const deferredQuery = useDeferredValue(params.q?.toLowerCase() || "");

	// 1. 右ペイン用アイテムの最優先（0ms）ダイレクト抽出
	// 中ペインの全件計算やフィルタリングの完了を待たず、キャッシュ（notes/drafts）から即時取得する
	const selectedNote = useMemo(() => {
		if (!params.noteId) return undefined;
		return notes.find((n) => n.id === params.noteId);
	}, [notes, params.noteId]);

	const selectedDraft = useMemo(
		() =>
			params.draftId ? drafts.find((d) => d.id === params.draftId) : undefined,
		[drafts, params.draftId],
	);

	// クエリデータの準備完了状態（対象ビューに必要なデータが準備できているか判定）
	// 💡 キャッシュデータが存在する場合は isLoading によるブロッキングをスキップし、手元データを0ms最優先描画する
	const isTabReady = useMemo(() => {
		if (deferredView === "drafts") {
			return drafts.length > 0 || !isDraftsLoading;
		}
		if (deferredView === "diaries") {
			return diaries.length > 0 || !isDiariesLoading;
		}
		return (
			notes.length > 0 ||
			drafts.length > 0 ||
			(!isNotesLoading && !isDraftsLoading)
		);
	}, [
		deferredView,
		drafts,
		isDraftsLoading,
		diaries,
		isDiariesLoading,
		notes,
		isNotesLoading,
	]);

	const groupedNotes = useMemo(() => {
		if (isNotesLoading || isDraftsLoading) return null;
		return groupNotes(notes, drafts);
	}, [notes, drafts, isNotesLoading, isDraftsLoading]);

	const isSearchActive = !!params.q || !!params.tags;

	// ★ 遅延させたパラメータ（deferredView等）を元にフィルタリング計算を行う
	const filteredItems = useMemo(() => {
		if (!isTabReady) return [];

		let items: (Note | Draft | Diary)[] = [];
		if (deferredView === "drafts") {
			items = drafts;
		} else if (deferredView === "diaries") {
			items = diaries;
		} else if (!groupedNotes) {
			items = [];
		} else if (deferredExact === "all") {
			const domainData = groupedNotes.domains[deferredDomain || ""];
			if (domainData) {
				items = [
					...domainData.domainNotes,
					...Object.values(domainData.pages).flat(),
				];
				// All Notes は日付降順固定（D&DやPin移動による順序崩れを防止）
				items.sort((a, b) => {
					const noteA = a as Note;
					const noteB = b as Note;
					return (
						new Date(noteB.created_at).getTime() -
						new Date(noteA.created_at).getTime()
					);
				});
			} else {
				items = [];
			}
		} else if (deferredExact === "domain") {
			const domainData = groupedNotes.domains[deferredDomain || ""];
			if (domainData) {
				items = [...domainData.domainNotes];
				items.sort((a, b) => {
					const noteA = a as Note;
					const noteB = b as Note;
					if (noteA.is_pinned !== noteB.is_pinned)
						return noteA.is_pinned ? -1 : 1;
					if (noteA.sort_order !== noteB.sort_order) {
						return (noteA.sort_order ?? 0) - (noteB.sort_order ?? 0);
					}
					return (
						new Date(noteB.created_at).getTime() -
						new Date(noteA.created_at).getTime()
					);
				});
			} else {
				items = [];
			}
		} else if (deferredExact) {
			items =
				groupedNotes.domains[deferredDomain || ""]?.pages[deferredExact] || [];
		} else if (deferredView === "inbox" || deferredDomain === "inbox") {
			items = groupedNotes.inbox;
		} else if (deferredDomain) {
			const domainData = groupedNotes.domains[deferredDomain];
			if (domainData) {
				items = [
					...domainData.domainNotes,
					...Object.values(domainData.pages).flat(),
				];
				items.sort((a, b) => {
					const noteA = a as Note;
					const noteB = b as Note;
					if (noteA.is_pinned !== noteB.is_pinned)
						return noteA.is_pinned ? -1 : 1;
					if (noteA.sort_order !== noteB.sort_order) {
						return (noteA.sort_order ?? 0) - (noteB.sort_order ?? 0);
					}
					return (
						new Date(noteB.created_at).getTime() -
						new Date(noteA.created_at).getTime()
					);
				});
			}
		} else if (isSearchActive) {
			items = [...notes, ...drafts];
		} else {
			items = notes;
		}

		if (!deferredQuery) return items;

		return items.filter((item) => {
			if ("date" in item) {
				const diary = item as Diary;
				return diary.content?.toLowerCase().includes(deferredQuery) ?? false;
			}

			if ("url_pattern" in item) {
				const note = item as Note;

				if (deferredView === "domains" && !deferredDomain && !isSearchActive) {
					const safeUrl = getSafeUrl(note.url_pattern);
					const searchableHost = safeUrl ? safeUrl.hostname : note.url_pattern;
					return searchableHost.toLowerCase().includes(deferredQuery);
				}

				if (deferredView === "domains" && deferredDomain && !deferredExact) {
					const safeUrl = getSafeUrl(note.url_pattern);
					const searchablePath = safeUrl
						? safeUrl.pathname + safeUrl.search
						: note.url_pattern;
					return searchablePath.toLowerCase().includes(deferredQuery);
				}

				if (note.content === undefined) return true;
				if (!note.content) return false;

				return note.content.toLowerCase().includes(deferredQuery);
			}

			const draft = item as Draft;
			return draft.content?.toLowerCase().includes(deferredQuery) ?? false;
		});
	}, [
		groupedNotes,
		deferredView,
		deferredDomain,
		deferredExact,
		isSearchActive,
		deferredQuery,
		notes,
		drafts,
		diaries,
		isTabReady,
	]);

	useEffect(() => {
		if (!isTabReady || filteredItems.length === 0) return;

		const missingIds = filteredItems
			.slice(0, 50)
			.filter(
				(item): item is Note =>
					"url_pattern" in item && item.content === undefined,
			)
			.map((item) => item.id);

		if (missingIds.length > 0) {
			fetchContentForIds(missingIds);
		}
	}, [filteredItems, isTabReady, fetchContentForIds]);

	return (
		<ResponsiveNotesLayout
			selectedNoteId={params.noteId ?? null}
			selectedDraftId={params.draftId ?? null}
			selectedDate={params.date ?? null}
			middleNode={
				<Suspense fallback={<MiddlePaneListSkeleton />}>
					<SWRBoundary
						data={isTabReady ? filteredItems : undefined}
						isLoading={!isTabReady}
						fallback={
							<MiddlePaneList
								items={[]}
								groupedNotes={
									groupedNotes || { inbox: [], drafts: [], domains: {} }
								}
								currentView={effectiveView}
								currentDomain={domain ?? null}
								currentExact={exact ?? null}
								selectedNoteId={params.noteId ?? null}
								selectedDraftId={params.draftId ?? null}
								isLoading={true}
							/>
						}
					>
						{(items) => (
							<MiddlePaneList
								items={items}
								groupedNotes={
									groupedNotes || { inbox: [], drafts: [], domains: {} }
								}
								currentView={effectiveView}
								currentDomain={domain ?? null}
								currentExact={exact ?? null}
								selectedNoteId={params.noteId ?? null}
								selectedDraftId={params.draftId ?? null}
								isLoading={false}
							/>
						)}
					</SWRBoundary>
				</Suspense>
			}
			rightNode={
				<Suspense fallback={<RightPaneSkeleton />}>
					<RightPaneDetail
						note={selectedNote}
						draft={selectedDraft}
						isNewNote={isNewNote}
						isLoading={isNotesLoading || isDraftsLoading}
					/>
				</Suspense>
			}
		/>
	);
}
