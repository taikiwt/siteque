"use client";

import type { Note } from "@sitecue/shared";
import { fetchDraftsByDate, fetchNotesByDate } from "@sitecue/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar } from "lucide-react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import NoteCard from "../../../studio/_components/NoteCard";

interface Props {
	date: string;
	onInsert?: (content: string) => void;
}

export function DiaryMaterialsPane({ date, onInsert }: Props) {
	const { data: materials, isLoading } = useQuery({
		queryKey: ["materials", date],
		queryFn: async () => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return { notes: [], drafts: [] };

			const [fetchedNotes, fetchedDrafts] = await Promise.all([
				fetchNotesByDate(supabase, user.id, date),
				fetchDraftsByDate(supabase, user.id, date),
			]);
			return { notes: fetchedNotes, drafts: fetchedDrafts };
		},
	});

	const notes = materials?.notes || [];
	const drafts = materials?.drafts || [];
	const hasMaterials = notes.length > 0 || drafts.length > 0;

	return (
		<div className="w-full h-full flex flex-col overflow-hidden bg-base-surface">
			{/* 1. 固定ヘッダー (shrink-0) */}
			<div className="p-4 border-b border-base-border shrink-0 bg-base-surface/50 h-14 flex items-center">
				<h2 className="text-xs font-bold text-action uppercase tracking-widest font-mono flex items-center gap-2">
					<Calendar className="w-3.5 h-3.5 text-neutral-400" />
					Materials of the Day (
					{isLoading ? "..." : notes.length + drafts.length})
				</h2>
			</div>

			{/* 2. 独立スクロール領域 (flex-1 overflow-y-auto min-h-0) */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 custom-scrollbar">
				<Suspense
					fallback={
						<div className="space-y-3">
							{["mat-skel-1", "mat-skel-2", "mat-skel-3"].map((key) => (
								<div
									key={key}
									className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100/50"
								/>
							))}
						</div>
					}
				>
					{isLoading ? (
						/* 💡 取得中: 枠組みを崩さずリスト領域内のみにスケルトンを表示 */
						<div className="space-y-3">
							{["mat-skel-1", "mat-skel-2", "mat-skel-3"].map((key) => (
								<div
									key={key}
									className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100/50"
								/>
							))}
						</div>
					) : !hasMaterials ? (
						<div className="text-center text-neutral-400 py-16 font-mono text-xs">
							No footprints collected today.
						</div>
					) : (
						<>
							{/* Notes Section */}
							{notes.length > 0 && (
								<div className="space-y-2">
									<h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
										Notes ({notes.length})
									</h3>
									<div className="space-y-2">
										{notes.map((note) => (
											<NoteCard
												key={note.id}
												note={note}
												onInsert={undefined}
												showTimeOnly={true}
											/>
										))}
									</div>
								</div>
							)}

							{/* Drafts Section */}
							{drafts.length > 0 && (
								<div className="space-y-2">
									<h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
										Drafts ({drafts.length})
									</h3>
									<div className="space-y-2">
										{drafts.map((draft) => (
											<NoteCard
												key={draft.id}
												note={
													{
														id: draft.id,
														content: draft.content || "",
														note_type: "info",
														created_at: draft.updated_at,
														updated_at: draft.updated_at,
														url_pattern: "",
														user_id: draft.user_id,
														is_expanded: false,
														is_favorite: false,
														is_pinned: false,
														is_resolved: false,
														sort_order: 0,
														tags: draft.tags,
														draft_id: null,
													} as Note
												}
												isDraft={true}
												showTimeOnly={true}
												rightAction={
													onInsert && (
														<Button
															type="button"
															onClick={() => onInsert(draft.content || "")}
															radius="full"
															size="icon-sm"
															variant="ghost"
															title="Insert to Editor"
														>
															<ArrowLeft
																className="w-3.5 h-3.5"
																aria-hidden="true"
															/>
														</Button>
													)
												}
											/>
										))}
									</div>
								</div>
							)}
						</>
					)}
				</Suspense>
			</div>
		</div>
	);
}
