"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Diary } from "@sitecue/shared";
import { getSafeUrl } from "@sitecue/shared";
import { GripVertical, MapPin } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { CustomLink as Link } from "@/components/ui/custom-link";
import { NoteStatusBadge } from "@/components/ui/note-status-badge";
import { cn } from "@/lib/utils";
import type { Draft, Note } from "../types";

const formatDate = (dateStr: string) => {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

interface NoteItemProps {
	item: Note | Draft | Diary;
	currentExact: string | null;
	selectedNoteId: string | null;
	selectedDraftId: string | null;
	searchParams: URLSearchParams;
	isSortable?: boolean;
	dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
	selectable?: boolean;
	isSelected?: boolean;
	onSelectChange?: (id: string, checked: boolean) => void;
	onTodoToggle?: (e: React.MouseEvent, id: string, resolved: boolean) => void;
}

function NoteItemComponent({
	item,
	currentExact,
	selectedNoteId,
	selectedDraftId,
	searchParams,
	isSortable = false,
	dragHandleProps = {},
	selectable = false,
	isSelected = false,
	onSelectChange,
	onTodoToggle,
}: NoteItemProps) {
	const [isExiting, setIsExiting] = useState(false);
	const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		return () => {
			if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
		};
	}, []);

	const isDiary = "date" in item && !("note_type" in item);

	if (isDiary) {
		const diary = item as Diary;
		const diaryDate = new Date(diary.date);
		const dayLabel = diaryDate.toLocaleDateString("en-US", {
			day: "numeric",
			weekday: "short",
		});
		const isActive =
			searchParams.get("date") === diary.date &&
			searchParams.get("view") === "diaries";

		const params = new URLSearchParams(searchParams.toString());
		params.set("view", "diaries");
		params.set("date", diary.date);
		params.delete("noteId");
		params.delete("draftId");

		return (
			<div
				className={cn(
					"group/card relative flex items-stretch transition-all duration-200",
					isActive ? "bg-base-surface" : "hover-safe:bg-base-surface/50",
				)}
			>
				<Link
					aria-label="View diary detail"
					className="absolute inset-0 z-0"
					href={`/notes?${params.toString()}`}
				/>
				<div className="flex-1 block py-4 px-4 pointer-events-none relative z-10 min-w-0">
					<div className="flex justify-between items-start mb-1">
						<h3 className="text-sm font-bold text-action">{dayLabel}</h3>
					</div>
					<p className="text-sm text-action line-clamp-1 break-words mb-2">
						{diary.content.replace(/\[\d{2}:\d{2}\]\n/g, "").split("\n")[0]}
					</p>
					{diary.topics && diary.topics.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{diary.topics.map((topic) => (
								<span
									key={topic}
									className="text-[10px] bg-base-border text-action px-1.5 py-0.5 rounded font-mono"
								>
									#{topic}
								</span>
							))}
						</div>
					)}
				</div>
			</div>
		);
	}

	const isNote = "note_type" in item;
	const isResolved = isNote && item.is_resolved;
	const isActive = isNote
		? selectedNoteId === item.id
		: selectedDraftId === item.id;

	const params = new URLSearchParams(searchParams.toString());
	if (isNote) {
		params.set("noteId", item.id);
		params.delete("draftId");
	} else {
		params.set("draftId", item.id);
		params.delete("noteId");
	}

	const handleTodoToggleClick = (e: React.MouseEvent) => {
		if (!isNote || isExiting) return;

		if (!item.is_resolved) {
			setIsExiting(true);
			exitTimerRef.current = setTimeout(() => {
				onTodoToggle?.(e, item.id, item.is_resolved);
				setIsExiting(false);
			}, 400);
		} else {
			onTodoToggle?.(e, item.id, item.is_resolved);
		}
	};

	return (
		<div
			data-testid="note-item"
			className={cn(
				"group/card relative flex items-stretch transition-all duration-400 ease-in-out",
				isActive ? "bg-base-surface" : "hover-safe:bg-base-surface/50",
				(isResolved || isExiting) && "opacity-50",
				isExiting && "line-through pointer-events-none",
			)}
		>
			<Link
				href={`/notes?${params.toString()}`}
				className="absolute inset-0 z-0"
				aria-label="View details"
			/>

			<div className="flex items-center pl-2 shrink-0 relative z-10 pointer-events-auto">
				{isSortable && isNote && (
					<button
						type="button"
						{...dragHandleProps}
						style={{ touchAction: "none" }}
						className="flex items-center justify-center p-1 text-base-border hover-safe:text-action opacity-100 pointer-fine:opacity-0 group-card-hover-safe:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
						aria-label="Drag to reorder"
					>
						<GripVertical className="w-4 h-4" aria-hidden="true" />
					</button>
				)}
				{!isSortable && isNote && <div className="w-6" />}

				{selectable && (
					<div className="flex items-center justify-center px-1">
						<input
							type="checkbox"
							checked={isSelected}
							onChange={(e) => onSelectChange?.(item.id, e.target.checked)}
							onPointerDown={(e) => e.stopPropagation()}
							className="w-4 h-4 cursor-pointer accent-action"
						/>
					</div>
				)}
			</div>

			<div className="flex-1 block py-4 pr-4 pl-2 pointer-events-none relative z-10 min-w-0">
				<div className="flex justify-between items-start mb-1">
					{isNote ? (
						<NoteStatusBadge
							type={item.note_type ?? "info"}
							isResolved={item.is_resolved || isExiting}
							onClick={(e) => {
								e.preventDefault();
								handleTodoToggleClick(e);
							}}
						/>
					) : (
						<span className="relative z-10 bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase">
							{!item.title && !item.content ? "NEW" : "DRAFT"}
						</span>
					)}
					<span className="text-[10px] text-gray-400 shrink-0">
						{formatDate(isNote ? item.created_at : item.updated_at)}
					</span>
				</div>
				<h3
					className={cn(
						"text-sm font-bold text-action truncate mb-0.5",
						(isResolved || isExiting) && "line-through",
					)}
				>
					{!isNote && (item.title || "Untitled Draft")}
				</h3>
				<p
					className={cn(
						"text-sm text-action line-clamp-3 min-h-[3.75rem] break-words",
						(isResolved || isExiting) && "line-through",
					)}
				>
					{item.content || ""}
				</p>
				{isNote && item.scope === "exact" && !currentExact && (
					<div className="mt-2 text-[10px] text-gray-400 truncate flex items-center gap-1 relative z-10 pointer-events-none break-all">
						<MapPin className="w-3 h-3" aria-hidden="true" />
						{getSafeUrl(item.url_pattern)?.pathname ?? item.url_pattern}
					</div>
				)}
			</div>
		</div>
	);
}

export const NoteItem = React.memo(NoteItemComponent);

interface SortableNoteItemProps {
	item: Note | Draft;
	currentView: string | null;
	currentExact: string | null;
	selectedNoteId: string | null;
	selectedDraftId: string | null;
	searchParams: URLSearchParams;
	isSearchActive: boolean;
	selectable?: boolean;
	isSelected?: boolean;
	onSelectChange?: (id: string, checked: boolean) => void;
	onTodoToggle?: (e: React.MouseEvent, id: string, resolved: boolean) => void;
}

function SortableNoteItemComponent({
	item,
	currentView,
	isSearchActive,
	currentExact,
	selectedNoteId,
	selectedDraftId,
	searchParams,
	selectable,
	isSelected,
	onSelectChange,
	onTodoToggle,
}: SortableNoteItemProps) {
	const {
		setNodeRef,
		transform,
		transition,
		isDragging,
		attributes,
		listeners,
	} = useSortable({
		id: item.id,
	});

	const style = {
		transform: CSS.Translate.toString(transform),
		transition,
		zIndex: isDragging ? 50 : undefined,
		position: "relative" as const,
	};

	return (
		<div ref={setNodeRef} style={style}>
			<NoteItem
				item={item}
				currentExact={currentExact}
				selectedNoteId={selectedNoteId}
				selectedDraftId={selectedDraftId}
				searchParams={searchParams}
				isSortable={currentView !== "drafts" && !isSearchActive}
				dragHandleProps={{ ...attributes, ...listeners }}
				selectable={selectable}
				isSelected={isSelected}
				onSelectChange={onSelectChange}
				onTodoToggle={onTodoToggle}
			/>
		</div>
	);
}

export const SortableNoteItem = React.memo(SortableNoteItemComponent);
