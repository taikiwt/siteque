"use client";

import {
	ArrowLeft,
	Check,
	ClipboardCopy,
	Copy,
	FileJson,
	FileText,
	ListChecks,
	Plus,
	SquareCheckBig,
	Trash2,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatedIconButton } from "@/components/ui/animated-icon-button";
import { Button } from "@/components/ui/button";
import { CustomLink as Link } from "@/components/ui/custom-link";
import { FilterBadge } from "@/components/ui/filter-badge";
import { HoverSwapButton } from "@/components/ui/hover-swap-button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { SearchInputBase } from "@/components/ui/search-input-base";
import { cn } from "@/lib/utils";
import type { Draft, Note } from "../types";

export type FilterType = "all" | "info" | "alert" | "idea";

interface MiddlePaneHeaderProps {
	currentView: string | null;
	currentDomain: string | null;
	currentExact: string | null;
	currentYear: string | null;
	currentMonth: string | null;
	inputValue: string;
	onInputChange: (val: string) => void;
	filterType: FilterType;
	onFilterTypeChange: (val: FilterType) => void;
	showResolved: boolean;
	onShowResolvedChange: (val: boolean) => void;
	isSelectMode: boolean;
	onSelectModeChange: (val: boolean) => void;
	selectedCount: number;
	onCancelSelection: () => void;
	onDeleteSelected: () => void;
	isDeletingBulk: boolean;
	displayItems: (Note | Draft)[];
	onBack: () => void;
}

export function MiddlePaneHeader({
	currentView,
	currentDomain,
	currentExact,
	currentYear,
	currentMonth,
	inputValue,
	onInputChange,
	filterType,
	onFilterTypeChange,
	showResolved,
	onShowResolvedChange,
	isSelectMode,
	onSelectModeChange,
	selectedCount,
	onCancelSelection,
	onDeleteSelected,
	isDeletingBulk,
	displayItems,
	onBack,
}: MiddlePaneHeaderProps) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const searchInputRef = useRef<HTMLInputElement>(null);

	const [isCopyPopoverOpen, setIsCopyPopoverOpen] = useState(false);
	const [copiedType, setCopiedType] = useState<"text" | "json" | null>(null);
	const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		};
	}, []);

	// 1. 外部からの q パラメータ変更時のみ同期
	const currentQParam = searchParams.get("q");
	useEffect(() => {
		if (
			searchInputRef.current &&
			document.activeElement === searchInputRef.current
		) {
			return;
		}
		if (currentQParam !== null) {
			onInputChange(currentQParam);
		}
	}, [currentQParam, onInputChange]);

	// 2. 階層コンテキスト（view, domain, exact）の切り替え時のみ検索文字をリセット
	const prevContextRef = useRef({
		view: currentView,
		domain: currentDomain,
		exact: currentExact,
	});
	useEffect(() => {
		const prev = prevContextRef.current;
		if (
			prev.view !== currentView ||
			prev.domain !== currentDomain ||
			prev.exact !== currentExact
		) {
			onInputChange("");
		}
		prevContextRef.current = {
			view: currentView,
			domain: currentDomain,
			exact: currentExact,
		};
	}, [currentView, currentDomain, currentExact, onInputChange]);

	// 一括コピー（表示中の displayItems をそのまま SSOT として対象化）
	const handleCopyAsText = async () => {
		const noteItems = displayItems.filter(
			(item): item is Note => "content" in item,
		);
		const text = noteItems
			.map((item) => item.content || "")
			.join("\n\n---\n\n");
		await navigator.clipboard.writeText(text);
		setCopiedType("text");

		if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		copyTimerRef.current = setTimeout(() => {
			setIsCopyPopoverOpen(false);
			setCopiedType(null);
		}, 1000);
	};

	const handleCopyAsJson = async () => {
		const simplifiedItems = displayItems
			.filter((item): item is Note => "note_type" in item)
			.map((note) => ({
				type: note.note_type,
				content: note.content || "",
			}));

		const json = JSON.stringify(simplifiedItems, null, 2);
		await navigator.clipboard.writeText(json);
		setCopiedType("json");

		if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		copyTimerRef.current = setTimeout(() => {
			setIsCopyPopoverOpen(false);
			setCopiedType(null);
		}, 1000);
	};

	const isSearchActive = !!inputValue || !!searchParams.get("tags");
	const isSelected =
		!!currentView || !!currentDomain || !!currentExact || isSearchActive;
	const isRouteDomains = currentView === "domains" && !currentDomain;
	const showActionGroup =
		isSelected &&
		currentView !== "drafts" &&
		currentView !== "diaries" &&
		!isRouteDomains;

	const getContextTitle = (): string | null => {
		if (currentView === "domains" && !currentDomain) return "Domain List";
		if (currentView === "drafts") return "Draft List";
		if (currentView === "diaries" && (!currentYear || !currentMonth))
			return "Diary Archive";
		return null;
	};

	const contextTitle = getContextTitle();
	const hasTier2Controls =
		isSelected &&
		currentView !== "drafts" &&
		currentView !== "diaries" &&
		!isRouteDomains;
	const hasBackButton =
		(currentDomain && currentDomain !== "inbox") ||
		(currentView === "diaries" && (currentYear || currentMonth));

	const isDiariesView = currentView === "diaries";
	const typeParam = filterType !== "all" ? `&type=${filterType}` : "";
	const plusHref = isDiariesView
		? "/notes?view=diaries&globalNew=note&intent=diary"
		: `/notes?domain=${currentDomain || "inbox"}${currentExact ? `&exact=${encodeURIComponent(currentExact)}` : ""}&new=note${typeParam}`;
	const plusTitle = isDiariesView ? "New Diary Log" : "New Note here";

	return (
		<div className="space-y-3">
			{/* 2段目：コントロール操作バー */}
			<div className="flex items-center justify-between w-full min-h-9 gap-2 relative">
				<div className="flex items-center min-w-[32px] relative z-10">
					{hasBackButton && (
						<button
							type="button"
							onClick={onBack}
							className="p-1.5 text-gray-400 hover:text-action rounded-full hover:bg-base-surface transition-colors animate-in fade-in zoom-in duration-200 cursor-pointer border border-base-border bg-base-bg"
							title="Go back"
						>
							<ArrowLeft aria-hidden="true" className="size-4" />
						</button>
					)}
				</div>

				<div
					className={cn(
						"flex items-center justify-center",
						hasTier2Controls
							? "flex-1 mx-auto"
							: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-full pointer-events-none",
					)}
				>
					{hasTier2Controls ? (
						<div className="flex items-center gap-0.5 bg-base-surface p-2 rounded-full animate-in fade-in duration-200">
							<FilterBadge
								isActive={filterType === "all"}
								onClick={() => onFilterTypeChange("all")}
								className="rounded-full px-2.5 py-1 text-xs"
							>
								All
							</FilterBadge>
							<FilterBadge
								isActive={filterType === "info"}
								onClick={() => onFilterTypeChange("info")}
								className="rounded-full px-2.5 py-1 text-xs"
							>
								Info
							</FilterBadge>
							<FilterBadge
								isActive={filterType === "alert"}
								onClick={() => onFilterTypeChange("alert")}
								className="rounded-full px-2.5 py-1 text-xs"
							>
								Alert
							</FilterBadge>
							<FilterBadge
								isActive={filterType === "idea"}
								onClick={() => onFilterTypeChange("idea")}
								className="rounded-full px-2.5 py-1 text-xs"
							>
								Idea
							</FilterBadge>
						</div>
					) : (
						contextTitle && (
							<span className="text-xs font-bold text-gray-400 tracking-wide uppercase animate-in fade-in duration-300 bg-base-surface rounded-full py-1 px-4">
								{contextTitle}
							</span>
						)
					)}
				</div>

				<div className="flex items-center gap-1 justify-end min-w-[32px] relative z-10">
					{hasTier2Controls && (
						<button
							type="button"
							onClick={() => onShowResolvedChange(!showResolved)}
							className={cn(
								"p-1.5 rounded-full border transition-colors cursor-pointer",
								showResolved
									? "bg-action text-action-text border-action"
									: "bg-base-bg text-gray-400 border-base-border hover:text-action hover:bg-base-surface",
							)}
							title="Show Resolved Notes"
						>
							<SquareCheckBig aria-hidden="true" className="w-4 h-4" />
						</button>
					)}
				</div>
			</div>

			{/* 3段目：可変検索窓 ＆ アクションボタン群 */}
			<div className="flex items-center w-full gap-2 animate-in fade-in duration-300">
				<div className="flex-1 min-w-0">
					<SearchInputBase
						ref={searchInputRef}
						value={inputValue}
						onChange={onInputChange}
						onClear={() => {
							onInputChange("");
							const params = new URLSearchParams(searchParams.toString());
							if (params.has("q")) {
								params.delete("q");
								router.replace(`${pathname}?${params.toString()}`, {
									scroll: false,
								});
							}
						}}
						onSubmit={() => {
							searchInputRef.current?.blur();
						}}
						placeholder="Search notes..."
						className="rounded-full text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-border/50"
						autoFocus={false}
					/>
				</div>

				{showActionGroup && (
					<div className="flex items-center gap-1 p-1 rounded-full shrink-0">
						<Link
							href={plusHref}
							title={plusTitle}
							className="p-1.5 text-gray-400 hover:text-action rounded-full hover:bg-base-surface transition-colors flex items-center justify-center w-7 h-7"
						>
							<Plus aria-hidden="true" className="size-4" />
						</Link>

						<AnimatedIconButton
							type="button"
							onClick={() => onSelectModeChange(!isSelectMode)}
							isActive={isSelectMode}
							icon={<ListChecks aria-hidden="true" className="size-4" />}
							activeIcon={<ListChecks aria-hidden="true" className="size-4" />}
							className={cn(
								"cursor-pointer rounded-full p-1 flex items-center justify-center w-7 h-7",
								isSelectMode
									? "text-neutral-900 bg-base-bg shadow-sm"
									: "text-gray-400 hover:text-action",
							)}
							title="Select Mode"
						/>
						<Popover
							open={isCopyPopoverOpen}
							onOpenChange={setIsCopyPopoverOpen}
						>
							<PopoverTrigger
								render={
									<HoverSwapButton
										type="button"
										defaultIcon={<Copy aria-hidden="true" className="size-4" />}
										hoverIcon={
											<ClipboardCopy aria-hidden="true" className="size-4" />
										}
										disableSuccessState={true}
										className={cn(
											"transition-colors cursor-pointer rounded-full p-1 flex items-center justify-center w-7 h-7",
											copiedType !== null
												? "text-note-info"
												: "text-gray-400 hover:text-action",
										)}
										title="Bulk Copy"
									/>
								}
							/>
							<PopoverContent align="end" className="w-48 p-2 rounded-xl">
								<div className="flex flex-col gap-1">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={handleCopyAsText}
										className="flex items-center justify-start gap-2 w-full px-2 py-1.5 font-medium rounded-lg text-neutral-500 hover:text-neutral-900 cursor-pointer"
									>
										{copiedType === "text" ? (
											<Check
												aria-hidden="true"
												className="w-3.5 h-3.5 text-note-info"
											/>
										) : (
											<FileText aria-hidden="true" className="w-3.5 h-3.5" />
										)}
										{copiedType === "text" ? "Copied!" : "as Text"}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={handleCopyAsJson}
										className="flex items-center justify-start gap-2 w-full px-2 py-1.5 font-medium rounded-lg text-neutral-500 hover:text-neutral-900 cursor-pointer"
									>
										{copiedType === "json" ? (
											<Check
												aria-hidden="true"
												className="w-3.5 h-3.5 text-note-info"
											/>
										) : (
											<FileJson aria-hidden="true" className="w-3.5 h-3.5" />
										)}
										{copiedType === "json" ? "Copied!" : "as JSON"}
									</Button>
								</div>
							</PopoverContent>
						</Popover>
					</div>
				)}
			</div>

			{/* 4段目：一括操作バー（Bulk Actions） */}
			{selectedCount > 0 && (
				<div className="flex items-center justify-between pt-1 border-t border-base-border border-dashed animate-in fade-in slide-in-from-top-1 duration-200">
					<span className="text-xs font-semibold text-action">
						{selectedCount} selected
					</span>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onCancelSelection}
							disabled={isDeletingBulk}
							className="text-gray-500 hover:text-action font-medium cursor-pointer rounded-full px-3"
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onClick={onDeleteSelected}
							disabled={isDeletingBulk}
							className="flex items-center gap-1.5 font-bold cursor-pointer rounded-full px-3"
						>
							<Trash2 aria-hidden="true" className="w-3 h-3" />
							{isDeletingBulk ? "Deleting..." : "Delete"}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
