import { getScopeUrls, SHARED_LIMITS } from "@sitecue/shared";
import {
	AlertTriangle,
	Check,
	ChevronDown,
	Copy,
	GripVertical,
	Info,
	Lightbulb,
	Loader2,
	Pencil,
	Pin,
	RotateCcw,
	Star,
	Trash2,
	X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import TextareaAutosize from "react-textarea-autosize";
import { useMarkdownAssist } from "../hooks/useMarkdownAssist";
import type { Note, NoteScope, NoteType } from "../hooks/useNotes";
import MarkdownRenderer from "./MarkdownRenderer";
import { Button } from "./ui/button";

// 💡 重いMarkdown解析・DOM描画部を content プロパティのみで厳格に要塞化するコンポーネント
const MemoizedMarkdown = React.memo(
	function MemoizedMarkdown({ content }: { content: string }) {
		return <MarkdownRenderer content={content} />;
	},
	(prevProps, nextProps) => prevProps.content === nextProps.content,
);

// ... 既存の NoteItemProps と NoteItem コンポーネント定義 ...

const COLLAPSE_THRESHOLD = 160;

// 💡 完了アニメーションの時間をここで一括管理します（ミリ秒単位）
// 2つの合計値はNoteList.tsx側のsetTimeoutと合わせる必要がある
const ANIM_STAGE1_DELAY = 300; // 前半：チェックマークだけを表示してカード形状を維持する時間
const ANIM_STAGE2_DURATION = 200; // 後半：カードが物理的に縮んでスライドして消える時間

interface NoteItemProps {
	note: Note;
	currentFullUrl: string;
	userPlan?: "free" | "pro" | "guest";
	onUpdate: (
		id: string,
		content: string,
		type: NoteType,
		scope: NoteScope,
	) => Promise<boolean>;
	onDelete: (id: string) => Promise<boolean>;
	onToggleResolved: (
		id: string,
		status: boolean | undefined,
	) => Promise<boolean>;
	onToggleFavorite: (note: Note) => Promise<boolean>;
	onTogglePinned: (note: Note) => Promise<boolean>;
	onToggleExpansion: (id: string, current: boolean) => Promise<boolean>;
	isFavoriteList?: boolean;
	isEditing: boolean;
	onRequestEdit: (id: string) => void;
	onSetIsEditDirty: (dirty: boolean) => void;
	isPreview?: boolean;
	isResolving?: boolean;
	sortableAttributes?: Record<string, unknown>;
	sortableListeners?: Record<string, unknown>;
	dragHandleRef?: React.Ref<HTMLDivElement>;
}

function NoteItem({
	note,
	currentFullUrl,
	userPlan = "free",
	onUpdate,
	onDelete,
	onToggleResolved,
	onToggleFavorite,
	onTogglePinned,
	onToggleExpansion,
	isFavoriteList = false,
	isEditing,
	onRequestEdit,
	onSetIsEditDirty,
	isPreview = false,
	isResolving = false,
	sortableAttributes,
	sortableListeners,
	dragHandleRef,
}: NoteItemProps) {
	const [editContent, setEditContent] = useState("");
	const [editType, setEditType] = useState<NoteType>("info");
	const [editScope, setEditScope] = useState<NoteScope>(note.scope);
	const [updating, setUpdating] = useState(false);
	const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
	const [isOverflowing, setIsOverflowing] = useState(() => {
		return (note.content ?? "").length > 120;
	});
	const isExpanded = note.is_expanded ?? false;
	const isCollapsed = isOverflowing && !isExpanded;
	const { onKeyDown, onPaste } = useMarkdownAssist();

	const cardRef = useRef<HTMLDivElement | null>(null);
	const prevExpandedRef = useRef(note.is_expanded);

	useEffect(() => {
		if (prevExpandedRef.current && !note.is_expanded) {
			if (
				cardRef.current &&
				typeof cardRef.current.scrollIntoView === "function"
			) {
				cardRef.current.scrollIntoView({
					behavior: "smooth",
					block: "nearest",
				});
			}
		}
		prevExpandedRef.current = note.is_expanded;
	}, [note.is_expanded]);

	// 編集終了（Save / Cancel）を検知して最上部へ自動スクロール
	const prevEditingRef = useRef(isEditing);

	useEffect(() => {
		if (prevEditingRef.current && !isEditing) {
			if (
				cardRef.current &&
				typeof cardRef.current.scrollIntoView === "function"
			) {
				cardRef.current.scrollIntoView({
					behavior: "smooth",
					block: "nearest",
				});
			}
		}
		prevEditingRef.current = isEditing;
	}, [isEditing]);

	// 長文見切れを絶対回避しつつ、100%滑らかに縮小させる scrollHeight ハック
	const [animatingHeight, setAnimatingHeight] = useState<number | null>(null);
	// 前半200ms（巨大チェックマーク露出中）と、後半400ms（崩落中）の物理フェーズをインメモリ追跡
	const [isCollapsePhase, setIsCollapsePhase] = useState(false);

	useEffect(() => {
		if (isResolving && cardRef.current) {
			// 1. まず実寸高さを測定して固定（クリッピングを完全に防止）
			const fullHeight = cardRef.current.scrollHeight;
			setAnimatingHeight(fullHeight);
			setIsCollapsePhase(false);

			// 2. 🔥【200msタイムライン直列同期の掟】
			// 200msの間は高さを100%維持し、中央の巨大チェックマークのフェードイン＆バウンスのビューポートを死守！
			// 200ms経過した瞬間に、collapseフェーズ（物理取り潰し）へ移行させる。
			const delayTimer = setTimeout(() => {
				setAnimatingHeight(0);
				setIsCollapsePhase(true);
			}, ANIM_STAGE1_DELAY);

			return () => {
				clearTimeout(delayTimer);
			};
		}
		setAnimatingHeight(null);
		setIsCollapsePhase(false);
	}, [isResolving]);

	// 変更検知（無変更保存ガード用防壁）
	const isUnchanged =
		editContent === note.content &&
		editScope === note.scope &&
		editType === (note.note_type || "info");

	const contentRef = useRef<HTMLDivElement>(null);

	// 💡 原本通りのシンプルで不具合のない高さ測定ロジックへ復元
	// biome-ignore lint/correctness/useExhaustiveDependencies: Needed to recalculate height on content change
	useEffect(() => {
		if (isPreview) return;
		const el = contentRef.current;
		if (!el) return;

		// 🚨 重要: display: none (hidden) 時は scrollHeight が 0 になるためガード！
		// 高さが正しく測定できる（> 0）可視化状態の場合のみ isOverflowing を評価する
		if (el.scrollHeight > 0) {
			setIsOverflowing(el.scrollHeight > COLLAPSE_THRESHOLD);
		}
	}, [note.content, isPreview]);

	const startEditing = () => {
		onRequestEdit(note.id);
		setEditContent(note.content);
		setEditType(note.note_type || "info");
		setEditScope(note.scope);
		onSetIsEditDirty(false);
	};

	const cancelEditing = () => {
		onRequestEdit("");
		setEditContent("");
		setEditType("info");
		setEditScope(note.scope);
		onSetIsEditDirty(false);
	};

	const handleUpdate = async () => {
		if (!editContent.trim()) return;
		if (
			(userPlan === "free" || userPlan === "guest") &&
			editContent.length > SHARED_LIMITS.NOTE_LENGTH.FREE
		) {
			toast.error(
				"Free plan limit is 10,000 characters. Please shorten text or upgrade.",
			);
			return;
		}
		setUpdating(true);
		const success = await onUpdate(note.id, editContent, editType, editScope);
		if (success) {
			onRequestEdit("");
			onSetIsEditDirty(false);
		}
		setUpdating(false);
	};

	const handleCopyNote = () => {
		navigator.clipboard.writeText(note.content);
		setCopiedNoteId(note.id);
		toast("Copied to clipboard");
		setTimeout(() => setCopiedNoteId(null), 2000);
	};

	let badgeBgColor = "bg-note-info/5";
	let badgeTextColor = "text-note-info";

	if (note.note_type === "alert") {
		badgeBgColor = "bg-note-alert/5";
		badgeTextColor = "text-note-alert";
	} else if (note.note_type === "idea") {
		badgeBgColor = "bg-note-idea/5";
		badgeTextColor = "text-note-idea";
	}

	const resolvedClasses = note.is_resolved ? "opacity-60 grayscale-[0.5]" : "";

	// アニメーション中の競合排除用クラス出し分け
	const paddingClass = isResolving && isCollapsePhase ? "p-0" : "p-0";
	const borderClass =
		isResolving && isCollapsePhase
			? "border-transparent"
			: "border-base-border";
	// 0ms時点で opacity-0 や scale-95 が入った瞬間にアニメーションが暴発するのを防ぎ、インライン style で秒数を個別管理します。
	const resolvingClasses = isResolving
		? ` opacity-0 translate-x-full pointer-events-none ${
				isCollapsePhase
					? "overflow-hidden py-0 my-0 border-y-0"
					: "overflow-visible"
			}`
		: " opacity-100 translate-x-0";

	return (
		<div
			ref={cardRef}
			style={{
				contentVisibility: "auto",
				maxHeight:
					animatingHeight !== null ? `${animatingHeight}px` : undefined,
				// 💡【タイムライン個別調律のベストプラクティス】
				// アニメーション時（isResolving === true）のみ、詳細度を上書きしてブラウザに時間差を直接命じる：
				//   - max-height: 200msのタイマーで animatingHeight = 0px になった瞬間から、ディレイなし（0ms遅延）で400msかけて縮む。
				//   - opacity / transform / padding / border / margin: 0msのOnClickの瞬間から 200ms のディレイを厳格に挟んで、後半の400msで綺麗にフェードアウトする。
				// 通常時はディレイや余韻のないサクサクとした快適な手触りを維持。
				transition: isResolving
					? `max-height ${ANIM_STAGE2_DURATION}ms ease-in 0ms, ` +
						`opacity ${ANIM_STAGE2_DURATION}ms ease-in ${ANIM_STAGE1_DELAY}ms, ` +
						`transform ${ANIM_STAGE2_DURATION}ms ease-in ${ANIM_STAGE1_DELAY}ms, ` +
						`translate ${ANIM_STAGE2_DURATION}ms ease-in ${ANIM_STAGE1_DELAY}ms, ` +
						`padding ${ANIM_STAGE2_DURATION}ms ease-in ${ANIM_STAGE1_DELAY}ms, ` +
						`border-color ${ANIM_STAGE2_DURATION}ms ease-in ${ANIM_STAGE1_DELAY}ms, ` +
						`margin ${ANIM_STAGE2_DURATION}ms ease-in ${ANIM_STAGE1_DELAY}ms`
					: "border-color 200ms ease-in-out, box-shadow 200ms ease-in-out, transform 200ms ease-in-out, translate 200ms ease-in-out",
			}}
			// 💡 className から一括指定の transition-all を完全削除！
			className={`bg-base-bg rounded-xl border group relative flex flex-col ${paddingClass} ${borderClass} ${resolvedClasses} ${resolvingClasses}`}
		>
			{/* カード全体を覆う多重防止グレーアウト＆中央チェックマークオーバーレイ */}
			{isResolving && (
				<div className="absolute inset-0 flex items-center justify-center bg-base-bg/85 rounded-xl z-30 animate-fadeIn pointer-events-none">
					{/* 💡 text-note-info から text-muted-foreground に変更し、translate-y-3 を追加して重心を真ん中へ下げる */}
					<Check aria-hidden="true" className="text-success size-10" />
				</div>
			)}
			{isEditing ? (
				<div className="space-y-3 flex flex-col flex-1 min-w-0 relative animate-fadeIn">
					<div className="sticky top-0 z-20 bg-base-bg flex flex-col gap-0 shrink-0 select-none border-b border-base-border/20">
						<div className="flex items-center justify-between w-full min-h-[40px] px-2">
							<div className="text-xs text-muted-foreground/50 font-semibold pl-1 select-none opacity-0">
								Editing note...
							</div>
							<div className="flex items-center gap-1.5">
								<Button
									variant="ghost"
									size="xs"
									icon={<X className="w-3.5 h-3.5" />}
									onClick={cancelEditing}
								>
									Cancel
								</Button>
								<Button
									variant="default"
									size="xs"
									icon={
										updating ? (
											<Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
										) : (
											<Check className="w-3.5 h-3.5" />
										)
									}
									onClick={handleUpdate}
									disabled={updating || isUnchanged}
								>
									Save
								</Button>
							</div>
						</div>

						<div className="flex items-center justify-between w-full py-1 px-2 border-t border-base-border/30">
							<div className="relative flex items-center shrink-0 px-4 py-2 bg-base-surface rounded-full">
								<select
									value={editScope}
									onChange={(e) => {
										const newScope = e.target.value as NoteScope;
										setEditScope(newScope);
										onSetIsEditDirty(
											editContent !== note.content ||
												newScope !== note.scope ||
												editType !== (note.note_type || "info"),
										);
									}}
									className="cursor-pointer appearance-none bg-transparent pr-4 py-0 text-xs font-bold text-neutral-800 focus:outline-none select-none border-none ring-0 focus:ring-0"
								>
									<option value="exact">Page Note</option>
									<option value="domain">Domain Note</option>
									<option value="inbox">Inbox Note</option>
								</select>
								<div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 text-[10px] select-none">
									▼
								</div>
							</div>

							<div className="flex p-1 rounded-full bg-base-surface border border-base-border/50 shrink-0 scale-85 origin-right">
								<button
									type="button"
									onClick={() => {
										setEditType("info");
										onSetIsEditDirty(
											editContent !== note.content ||
												editScope !== note.scope ||
												"info" !== (note.note_type || "info"),
										);
									}}
									className={`cursor-pointer flex items-center justify-center rounded-full size-6 transition-colors ${
										editType === "info"
											? "bg-note-info text-action-text shadow-2xs"
											: "text-muted-foreground hover:text-note-info"
									}`}
									title="Info"
								>
									<Info className="size-4" />
								</button>
								<button
									type="button"
									onClick={() => {
										setEditType("alert");
										onSetIsEditDirty(
											editContent !== note.content ||
												editScope !== note.scope ||
												"alert" !== (note.note_type || "info"),
										);
									}}
									className={`cursor-pointer flex items-center justify-center rounded-full size-6 transition-colors ml-0.5 ${
										editType === "alert"
											? "bg-note-alert text-action-text shadow-2xs"
											: "text-muted-foreground hover:text-note-alert"
									}`}
									title="Alert"
								>
									<AlertTriangle className="size-4" />
								</button>
								<button
									type="button"
									onClick={() => {
										setEditType("idea");
										onSetIsEditDirty(
											editContent !== note.content ||
												editScope !== note.scope ||
												"idea" !== (note.note_type || "info"),
										);
									}}
									className={`cursor-pointer flex items-center justify-center rounded-full size-6 transition-colors ml-0.5 ${
										editType === "idea"
											? "bg-note-idea text-action-text shadow-2xs"
											: "text-muted-foreground hover:text-note-idea"
									}`}
									title="Idea"
								>
									<Lightbulb className="size-4" />
								</button>
							</div>
						</div>
					</div>

					<div className="flex-1 min-w-0 w-full px-2">
						<TextareaAutosize
							value={editContent}
							onChange={(e) => {
								const newContent = e.target.value;
								setEditContent(newContent);
								onSetIsEditDirty(
									newContent !== note.content ||
										editScope !== note.scope ||
										editType !== (note.note_type || "info"),
								);
							}}
							className="w-full border border-base-border rounded-xl p-2.5 text-sm bg-base-bg text-neutral-800 antialiased font-['Hack'] font-mono leading-[1.6] tracking-[0.03em] focus:outline-none focus:ring-0"
							autoFocus
							onKeyDown={(e) => {
								if (e.nativeEvent.isComposing) return;
								if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
									e.preventDefault();
									if (editContent.trim() && !isUnchanged) {
										handleUpdate();
									}
								} else {
									onKeyDown(e);
								}
							}}
							onPaste={onPaste}
						/>
					</div>
				</div>
			) : (
				<div className="flex flex-col flex-1">
					<div className="sticky top-0 z-20 bg-base-bg flex flex-col gap-0 select-none border-b border-base-border/20">
						<div className="flex items-center justify-between w-full min-h-[40px] px-2 transition-colors">
							<div className="flex items-center gap-1 shrink-0">
								{!isPreview && (
									<div
										ref={dragHandleRef}
										{...sortableAttributes}
										{...sortableListeners}
										style={{ touchAction: "none" }}
										className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-action transition-colors shrink-0"
										title="Drag to reorder"
									>
										<GripVertical className="size-4" aria-hidden="true" />
									</div>
								)}
								<button
									type="button"
									onClick={() => onToggleResolved(note.id, note.is_resolved)}
									className={`group/icon relative flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer transition-all ${badgeBgColor} ${badgeTextColor} hover:opacity-80 shrink-0`}
									title={
										note.is_resolved ? "Mark as unresolved" : "Mark as resolved"
									}
								>
									<div className="relative w-3.5 h-3.5 shrink-0">
										<div className="absolute inset-0 transition-opacity group-hover/icon:opacity-0">
											{note.note_type === "alert" && (
												<AlertTriangle
													className="w-3.5 h-3.5"
													aria-hidden="true"
												/>
											)}
											{note.note_type === "idea" && (
												<Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
											)}
											{(note.note_type === "info" || !note.note_type) && (
												<Info className="w-3.5 h-3.5" aria-hidden="true" />
											)}
										</div>
										<div className="absolute inset-0 flex items-center justify-center opacity-0 transition-transform duration-200 group-hover/icon:opacity-100 group-hover/icon:scale-125">
											{note.is_resolved ? (
												<RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
											) : (
												<Check className="w-3.5 h-3.5" aria-hidden="true" />
											)}
										</div>
									</div>

									<span
										className={`text-[11px] font-bold tracking-wide uppercase ${note.is_resolved ? "line-through opacity-70" : ""}`}
									>
										{note.note_type || "info"}
									</span>
								</button>
							</div>

							<div className="flex items-center gap-2 ml-auto shrink-0">
								{!isPreview && (
									<div className="flex items-center gap-0.5 pr-1.5 border-r border-base-border/30">
										<Button
											variant="ghost"
											size="sm"
											className="size-7 p-0 rounded-full text-muted-foreground/60 hover:text-action hover:bg-base-surface"
											icon={<Pencil className="size-4" />}
											onClick={startEditing}
											title="Edit"
										/>
										<Button
											variant="ghost"
											size="sm"
											className="size-7 p-0 rounded-full text-muted-foreground/60 hover:text-action hover:bg-base-surface"
											icon={
												copiedNoteId === note.id ? (
													<Check className="w-3.5 h-3.5 text-success" />
												) : (
													<Copy className="w-3.5 h-3.5" />
												)
											}
											onClick={handleCopyNote}
											title="Copy note"
										/>
										<Button
											variant="destructive2"
											size="sm"
											className="size-7 p-0 rounded-full text-muted-foreground/60"
											icon={<Trash2 className="w-3.5 h-3.5" />}
											onClick={() => onDelete(note.id)}
											title="Delete"
										/>
									</div>
								)}

								<div className="flex items-center gap-1 pl-0.5">
									<Button
										variant="ghost"
										size="xs"
										className={`size-7 p-0 rounded-full transition-all duration-200 ${note.is_favorite ? "text-action bg-action/5" : "text-muted-foreground/50"}`}
										icon={
											<Star
												className={`w-3.5 h-3.5 ${note.is_favorite ? "fill-current" : ""}`}
											/>
										}
										onClick={() => onToggleFavorite(note)}
										title={
											note.is_favorite
												? "Remove from favorites"
												: "Add to favorites"
										}
									/>
									<Button
										variant="ghost"
										size="xs"
										className={`size-7 p-0 rounded-full transition-all duration-200 ${note.is_pinned ? "text-action bg-action/5" : "text-muted-foreground/50"}`}
										icon={
											<Pin
												className={`w-3.5 h-3.5 ${note.is_pinned ? "fill-current text-action" : ""}`}
											/>
										}
										onClick={() => onTogglePinned(note)}
										title={note.is_pinned ? "Unpin note" : "Pin note"}
									/>
								</div>
							</div>
						</div>

						{isOverflowing && isExpanded && (
							<div className="absolute top-11 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onToggleExpansion(note.id, isExpanded);
									}}
									className="cursor-pointer text-[10px] font-bold text-muted-foreground hover:text-action hover:bg-base-surface/80 px-2.5 py-1 rounded-full flex items-center gap-1 transition-all border border-base-border/50 bg-base-bg/90 shadow-sm"
								>
									<ChevronDown className="w-3.5 h-3.5 shrink-0 rotate-180" />
									<span>Show less</span>
								</button>
							</div>
						)}
					</div>

					<div className="mt-2 flex-1 min-w-0">
						<div
							className={`relative ${isCollapsed ? "max-h-40 overflow-hidden pb-8" : ""} w-full`}
						>
							<div
								ref={contentRef}
								className={`text-sm px-4 py-2 ${
									note.is_resolved
										? "line-through text-muted-foreground"
										: "text-action"
								}`}
							>
								<MemoizedMarkdown content={note.content} />
							</div>

							{isCollapsed && (
								<>
									<div className="absolute bottom-0 left-0 w-full h-16 bg-linear-to-t from-base-bg via-base-bg/80 to-transparent pointer-events-none" />
									<div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												onToggleExpansion(note.id, isExpanded);
											}}
											className="cursor-pointer text-[10px] font-bold text-muted-foreground hover:text-action bg-base-bg hover:bg-base-surface px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1 transition-colors border border-base-border"
										>
											<ChevronDown className="w-3.5 h-3.5 shrink-0" />
											<span>Read more</span>
										</button>
									</div>
								</>
							)}
						</div>
					</div>

					{isFavoriteList && note.scope !== "inbox" && (
						<div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-1">
							<span
								className={`px-2 py-0.5 rounded-full border ${note.scope === "exact" ? "bg-base-bg border-base-border text-gray-500" : "bg-base-surface border-base-border text-muted-foreground"}`}
							>
								{note.scope === "exact" ? "Page" : "Domain"}
							</span>
							{note.url_pattern !==
								(note.scope === "domain"
									? getScopeUrls(currentFullUrl).domain
									: getScopeUrls(currentFullUrl).exact) && (
								<a
									href={`https://${note.url_pattern}`}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-1 hover:text-blue-400 hover:underline transition-colors max-w-48 truncate"
									title={`Open ${note.url_pattern}`}
								>
									<span className="truncate hover:text-action">
										{note.url_pattern}
									</span>
								</a>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function arePropsEqual(prevProps: NoteItemProps, nextProps: NoteItemProps) {
	const prevNote = prevProps.note;
	const nextNote = nextProps.note;

	// 💡 note オブジェクトの参照比較＋重要な内包プロパティの比較
	const isNoteEqual =
		prevNote === nextNote ||
		(prevNote.id === nextNote.id &&
			prevNote.content === nextNote.content &&
			prevNote.is_expanded === nextNote.is_expanded &&
			prevNote.is_favorite === nextNote.is_favorite &&
			prevNote.is_pinned === nextNote.is_pinned &&
			prevNote.is_resolved === nextNote.is_resolved &&
			prevNote.note_type === nextNote.note_type &&
			prevNote.scope === nextNote.scope);

	return (
		isNoteEqual &&
		prevProps.currentFullUrl === nextProps.currentFullUrl &&
		prevProps.isFavoriteList === nextProps.isFavoriteList &&
		prevProps.isEditing === nextProps.isEditing &&
		prevProps.isResolving === nextProps.isResolving &&
		prevProps.isPreview === nextProps.isPreview &&
		prevProps.onRequestEdit === nextProps.onRequestEdit &&
		prevProps.onSetIsEditDirty === nextProps.onSetIsEditDirty &&
		prevProps.onUpdate === nextProps.onUpdate &&
		prevProps.onDelete === nextProps.onDelete &&
		prevProps.onToggleResolved === nextProps.onToggleResolved &&
		prevProps.onToggleFavorite === nextProps.onToggleFavorite &&
		prevProps.onTogglePinned === nextProps.onTogglePinned &&
		prevProps.onToggleExpansion === nextProps.onToggleExpansion
	);
}

// 💡 カスタム比較関数を渡して React.memo を100%確実に機能させる
export default React.memo(NoteItem, arePropsEqual);
