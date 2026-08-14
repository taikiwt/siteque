"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const VIEWS = ["domains", "inbox", "drafts", "diaries"] as const;
type ViewType = (typeof VIEWS)[number];

interface NotesTabBarProps {
	currentView: string | null;
	onTabSwitch?: () => void;
}

export function NotesTabBar({ currentView, onTabSwitch }: NotesTabBarProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const activeView = currentView || "domains";
	const [optimisticView, setOptimisticView] = useState<string>(activeView);

	// ブラウザバック等のURL変更に追従
	useEffect(() => {
		setOptimisticView(activeView);
	}, [activeView]);

	const handleTabClick = (view: ViewType) => {
		setOptimisticView(view);
		onTabSwitch?.();

		const params = new URLSearchParams(searchParams.toString());
		params.set("view", view);
		params.delete("domain");
		params.delete("exact");
		params.delete("noteId");
		params.delete("draftId");
		params.delete("date");
		params.delete("q");

		if (view === "diaries") {
			if (!params.has("year") || !params.has("month")) {
				const now = new Date();
				params.set("year", now.getFullYear().toString());
				params.set("month", String(now.getMonth() + 1).padStart(2, "0"));
			}
		} else {
			params.delete("year");
			params.delete("month");
		}

		router.replace(`${pathname}?${params.toString()}`, { scroll: false });
	};

	return (
		<div className="flex justify-start w-full items-center h-11">
			<div className="grid grid-cols-4 gap-1 w-full bg-base-surface rounded-full border-none">
				{VIEWS.map((view) => {
					const isActive = optimisticView === view;
					return (
						<button
							key={view}
							type="button"
							onClick={() => handleTabClick(view)}
							className={cn(
								"px-1 py-2.5 text-xs font-bold rounded-full transition-all cursor-pointer text-center",
								isActive
									? "bg-action text-action-text shadow-sm"
									: "text-neutral-500 hover:text-action hover:bg-base-bg/60",
							)}
						>
							{view.charAt(0).toUpperCase() + view.slice(1)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
