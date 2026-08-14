"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { type Diary, getSafeUrl } from "@sitecue/shared";
import { ChevronRight, FileText, Globe, Inbox } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { RefObject } from "react";
import { CustomLink as Link } from "@/components/ui/custom-link";
import { DomainFavicon } from "../../_components/DomainFavicon";
import type { Draft, GroupedNotes, Note } from "../types";
import { NoteItem, SortableNoteItem } from "./NoteItem";
import { MiddlePaneListSkeleton } from "./NotesSkeletons";

const MONTH_MAP: Record<string, string> = {
	"01": "Jan",
	"02": "Feb",
	"03": "Mar",
	"04": "Apr",
	"05": "May",
	"06": "Jun",
	"07": "Jul",
	"08": "Aug",
	"09": "Sep",
	"10": "Oct",
	"11": "Nov",
	"12": "Dec",
};

interface MiddlePaneContentProps {
	items: (Note | Draft | Diary)[];
	searchedDisplayItems: (Note | Draft)[];
	groupedNotes: GroupedNotes;
	currentView: string | null;
	currentDomain: string | null;
	currentExact: string | null;
	currentYear: string | null;
	currentMonth: string | null;
	query: string;
	isSearchActive: boolean;
	selectedNoteId: string | null;
	selectedDraftId: string | null;
	isSelectMode: boolean;
	selectedIds: Set<string>;
	onSelectChange: (id: string, checked: boolean) => void;
	onTodoToggle: (e: React.MouseEvent, id: string, resolved: boolean) => void;
	onDragEnd: (event: DragEndEvent) => void;
	onDrilldown: (e: React.MouseEvent, href: string) => void;
	onUpdateParams: (key: string, value: string) => void;
	scrollRef: RefObject<HTMLDivElement | null>;
	isLoading?: boolean;
}

export function MiddlePaneContent({
	items,
	searchedDisplayItems,
	groupedNotes,
	currentView,
	currentDomain,
	currentExact,
	currentYear,
	currentMonth,
	query,
	isSearchActive,
	selectedNoteId,
	selectedDraftId,
	isSelectMode,
	selectedIds,
	onSelectChange,
	onTodoToggle,
	onDragEnd,
	onDrilldown,
	onUpdateParams,
	scrollRef,
	isLoading = false,
}: MiddlePaneContentProps) {
	const searchParams = useSearchParams();
	const diaries = items.filter(
		(item): item is Diary => "date" in item && !("note_type" in item),
	);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 5,
			},
		}),
	);

	const isSelected =
		!!currentView || !!currentDomain || !!currentExact || isSearchActive;

	return (
		<div
			ref={scrollRef}
			className="flex-1 overflow-y-auto divide-y divide-base-border"
		>
			{isLoading ? (
				<MiddlePaneListSkeleton />
			) : currentView === "diaries" ? (
				(() => {
					const years = Array.from(
						new Set(diaries.map((d) => d.date.split("-")[0])),
					).sort((a, b) => b.localeCompare(a));
					const filteredYears = years.filter(
						(year) => !query || year.includes(query),
					);
					if (!currentYear) {
						return filteredYears.length > 0 ? (
							filteredYears.map((year) => (
								<button
									key={year}
									type="button"
									onClick={() => onUpdateParams("year", year)}
									className="w-full flex items-center justify-between p-4 hover-safe:bg-base-surface text-left cursor-pointer transition-colors group"
								>
									<span className="text-sm font-medium text-action">
										{year}
									</span>
									<ChevronRight
										aria-hidden="true"
										className="w-4 h-4 text-gray-300 group-hover-safe:text-action"
									/>
								</button>
							))
						) : (
							<div className="flex flex-col items-center justify-center h-64 p-8 text-center text-gray-400">
								<Inbox
									aria-hidden="true"
									className="w-12 h-12 mb-4 text-base-border"
								/>
								<p className="text-sm font-medium">No diaries found</p>
							</div>
						);
					}

					if (currentYear && !currentMonth) {
						const months = Array.from(
							new Set(
								diaries
									.filter((d) => d.date.startsWith(currentYear))
									.map((d) => d.date.split("-")[1]),
							),
						).sort((a, b) => b.localeCompare(a));
						const fullMonths: Record<string, string> = {
							"01": "january",
							"02": "february",
							"03": "march",
							"04": "april",
							"05": "may",
							"06": "june",
							"07": "july",
							"08": "august",
							"09": "september",
							"10": "october",
							"11": "november",
							"12": "december",
						};
						const filteredMonths = months.filter((month) => {
							if (!query) return true;
							const shortEng = (MONTH_MAP[month] || "").toLowerCase();
							const fullEng = fullMonths[month] || "";
							return (
								month.includes(query) ||
								shortEng.includes(query) ||
								fullEng.includes(query)
							);
						});
						return filteredMonths.length > 0 ? (
							filteredMonths.map((month) => (
								<button
									key={month}
									type="button"
									onClick={() => onUpdateParams("month", month)}
									className="w-full flex items-center justify-between p-4 hover-safe:bg-base-surface text-left cursor-pointer transition-colors group"
								>
									<span className="text-sm font-medium text-action">
										{MONTH_MAP[month] || month}
									</span>
									<ChevronRight
										aria-hidden="true"
										className="w-4 h-4 text-gray-300 group-hover-safe:text-action"
									/>
								</button>
							))
						) : (
							<div className="flex flex-col items-center justify-center h-64 p-8 text-center text-gray-400">
								<Inbox
									aria-hidden="true"
									className="w-12 h-12 mb-4 text-base-border"
								/>
								<p className="text-sm font-medium">
									No diaries found for this year
								</p>
							</div>
						);
					}

					const filteredDiaries = diaries.filter((d) =>
						d.date.startsWith(`${currentYear}-${currentMonth}`),
					);
					const displayDiaries = filteredDiaries.filter((diary) => {
						if (!query) return true;
						const diaryDate = new Date(diary.date);
						const dayLabel = diaryDate.toLocaleDateString("en-US", {
							day: "numeric",
							weekday: "short",
						});
						const matchStr =
							`${diary.content} ${diary.date}${dayLabel}`.toLowerCase();
						return matchStr.includes(query);
					});
					return displayDiaries.length > 0 ? (
						displayDiaries.map((diary) => (
							<NoteItem
								key={diary.date}
								item={diary}
								currentExact={currentExact}
								selectedNoteId={selectedNoteId}
								selectedDraftId={selectedDraftId}
								searchParams={searchParams}
								selectable={false}
								onTodoToggle={() => {}}
							/>
						))
					) : (
						<div className="flex flex-col items-center justify-center h-64 p-8 text-center text-gray-400">
							<Inbox
								aria-hidden="true"
								className="w-12 h-12 mb-4 text-base-border"
							/>
							<p className="text-sm font-medium">
								No diaries found for this month
							</p>
						</div>
					);
				})()
			) : currentView === "domains" && !currentDomain ? (
				Object.entries(groupedNotes.domains)
					.filter(([domain]) => domain !== "inbox")
					.filter(([domain]) => !query || domain.toLowerCase().includes(query))
					.map(([domain, data]) => (
						<Link
							key={domain}
							href={`/notes?domain=${domain}`}
							onClick={(e) => onDrilldown(e, `/notes?domain=${domain}`)}
							className="flex items-center justify-between p-4 hover-safe:bg-base-surface transition-colors group"
						>
							<div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
								<div className="p-2 bg-base-surface rounded-lg group-hover-safe:bg-base-bg border border-base-border transition-colors shrink-0">
									<DomainFavicon domain={domain} sizeClassName="w-5 h-5" />
								</div>
								<div className="flex flex-col min-w-0 flex-1">
									<span
										className="text-sm font-medium text-action truncate block"
										title={domain}
									>
										{domain}
									</span>
									<span className="text-xs text-gray-400 shrink-0">
										{data.domainNotes.length +
											Object.values(data.pages).flat().length}{" "}
										notes
									</span>
								</div>
							</div>
							<ChevronRight
								aria-hidden="true"
								className="w-4 h-4 text-gray-300 shrink-0"
							/>
						</Link>
					))
			) : currentDomain && currentDomain !== "inbox" && !currentExact ? (
				<>
					{!query && (
						<Link
							href={`/notes?domain=${currentDomain}&exact=all`}
							onClick={(e) =>
								onDrilldown(e, `/notes?domain=${currentDomain}&exact=all`)
							}
							className="flex items-center justify-between p-4 hover-safe:bg-base-surface transition-colors group"
						>
							<div className="flex items-center gap-3">
								<div className="p-2 bg-base-surface rounded-lg group-hover-safe:bg-base-bg border border-base-border transition-colors">
									<Globe
										aria-hidden="true"
										className="w-5 h-5 text-note-info"
									/>
								</div>
								<span className="text-sm font-medium text-action">
									Domain Notes
								</span>
							</div>
							<ChevronRight
								aria-hidden="true"
								className="w-4 h-4 text-gray-300"
							/>
						</Link>
					)}
					{Object.entries(groupedNotes.domains[currentDomain]?.pages || {})
						.filter(([url]) => {
							if (!query) return true;
							const safeUrl = getSafeUrl(url);
							const searchablePath = safeUrl
								? safeUrl.pathname + safeUrl.search
								: url;

							return searchablePath.toLowerCase().includes(query);
						})
						.map(([url, notes]) => {
							const safeUrl = getSafeUrl(url);
							const path = safeUrl ? safeUrl.pathname + safeUrl.search : url;
							return (
								<Link
									key={url}
									href={`/notes?domain=${currentDomain}&exact=${encodeURIComponent(url)}`}
									onClick={(e) =>
										onDrilldown(
											e,
											`/notes?domain=${currentDomain}&exact=${encodeURIComponent(url)}`,
										)
									}
									className="flex items-center justify-between p-4 hover-safe:bg-base-surface transition-colors group"
								>
									<div className="flex items-center gap-3 overflow-hidden">
										<div className="p-2 bg-base-surface rounded-lg group-hover-safe:bg-base-bg border border-base-border transition-colors shrink-0">
											<FileText
												aria-hidden="true"
												className="w-5 h-5 text-gray-400 group-hover-safe:text-action"
											/>
										</div>
										<div className="flex flex-col min-w-0">
											<span
												className="text-sm font-medium text-action truncate"
												title={url}
											>
												{path}
											</span>
											<span className="text-xs text-gray-400">
												{notes.length} notes
											</span>
										</div>
									</div>
									<ChevronRight
										aria-hidden="true"
										className="w-4 h-4 text-gray-300 shrink-0"
									/>
								</Link>
							);
						})}
				</>
			) : (
				<div className="flex flex-col h-full">
					{!isSelected ? (
						<div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-400">
							<Inbox
								aria-hidden="true"
								className="w-10 h-10 mb-4 text-gray-300"
							/>
							<p className="text-sm font-medium">
								Please select a category from the list
							</p>
							<p className="text-xs mt-2">
								Select Inbox, Drafts, or a Domain
								<br />
								to see the list of items
							</p>
						</div>
					) : searchedDisplayItems.length > 0 ? (
						<div className="divide-y divide-base-border">
							{currentView === "drafts" ? (
								searchedDisplayItems.map((item) => (
									<NoteItem
										key={item.id}
										item={item}
										currentExact={currentExact}
										selectedNoteId={selectedNoteId}
										selectedDraftId={selectedDraftId}
										searchParams={searchParams}
										selectable={false}
										onTodoToggle={onTodoToggle}
									/>
								))
							) : (
								<DndContext
									id="notes-dnd-context"
									sensors={sensors}
									collisionDetection={closestCenter}
									onDragEnd={onDragEnd}
								>
									<SortableContext
										items={searchedDisplayItems.map((item) => item.id)}
										strategy={verticalListSortingStrategy}
									>
										{searchedDisplayItems.map((item) => (
											<SortableNoteItem
												key={item.id}
												item={item}
												currentView={currentView}
												isSearchActive={isSearchActive}
												currentExact={currentExact}
												selectedNoteId={selectedNoteId}
												selectedDraftId={selectedDraftId}
												searchParams={searchParams}
												selectable={currentView !== "drafts" && isSelectMode}
												isSelected={selectedIds.has(item.id)}
												onSelectChange={onSelectChange}
												onTodoToggle={onTodoToggle}
											/>
										))}
									</SortableContext>
								</DndContext>
							)}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center h-64 p-8 text-center text-gray-400">
							<Inbox
								aria-hidden="true"
								className="w-12 h-12 mb-4 text-base-border"
							/>
							<p className="text-sm">
								No {currentView === "drafts" ? "drafts" : "notes"} found for
								this category.
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
