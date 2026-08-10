import { Skeleton } from "@/components/ui/skeleton";

export function MiddlePaneListSkeleton() {
	return (
		<div className="flex-1 overflow-y-auto px-4 py-2">
			<div className="space-y-4">
				{[
					"note-skel-1",
					"note-skel-2",
					"note-skel-3",
					"note-skel-4",
					"note-skel-5",
					"note-skel-6",
					"note-skel-7",
					"note-skel-8",
					"note-skel-9",
					"note-skel-10",
				].map((id) => (
					<div
						key={id}
						className="flex flex-col gap-2 border-b border-base-border/50 pb-4 h-[80px]"
					>
						<div className="flex items-center justify-between">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-3 w-16" />
						</div>
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-4 w-5/6" />
					</div>
				))}
			</div>
		</div>
	);
}

export function RightPaneSkeleton() {
	return (
		<div className="flex flex-1 flex-col h-full bg-base-bg">
			<div className="flex items-center justify-between p-4 border-b border-base-border h-14">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-8 w-20 rounded-full" />
			</div>
			<div className="flex-1 p-6 space-y-4">
				<Skeleton className="h-6 w-3/4" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-5/6" />
			</div>
		</div>
	);
}

export function NotesContainerSkeleton() {
	return (
		<div className="flex h-screen overflow-hidden bg-base-bg text-action">
			{/* Middle Pane Skeleton Shell */}
			<div className="flex flex-col h-full bg-base-bg md:border-r md:border-base-border md:w-96 w-full shrink-0">
				<div className="flex-shrink-0 p-4 space-y-3 border-b border-base-border bg-base-bg">
					<div className="flex justify-start w-full items-center h-11">
						<div className="grid grid-cols-4 gap-1 w-full bg-base-surface rounded-full border-none">
							{["Domains", "Inbox", "Drafts", "Diaries"].map((view) => (
								<div
									key={view}
									className="px-1 py-2.5 text-xs font-bold rounded-full text-center text-neutral-500"
								>
									{view}
								</div>
							))}
						</div>
					</div>
				</div>
				<MiddlePaneListSkeleton />
			</div>

			{/* Right Pane Skeleton Shell (Desktop) */}
			<div className="hidden md:flex flex-1 flex-col h-full bg-base-bg">
				<div className="flex items-center justify-between p-4 border-b border-base-border h-14">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-8 w-20 rounded-full" />
				</div>
				<div className="flex-1 p-6 space-y-4">
					<Skeleton className="h-6 w-3/4" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-5/6" />
				</div>
			</div>
		</div>
	);
}
