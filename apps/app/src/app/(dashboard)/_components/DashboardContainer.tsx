"use client";

import { buildNoteContextHref } from "@sitecue/shared";
import type { DashboardOverviewData } from "@sitecue/shared/dal";
import { Activity, CalendarDays, Edit3, FileText, Layers } from "lucide-react";
import { Suspense } from "react";
import { CustomLink, CustomLink as Link } from "@/components/ui/custom-link";
import { SWRBoundary } from "@/components/ui/swr-boundary";
import { useFetchDashboardData } from "@/hooks/useDashboardQuery";
import { AppendDiaryButton } from "./AppendDiaryButton";
import { ContributionTimeline } from "./ContributionTimeline";
import { DomainDashboardCard } from "./DomainDashboardCard";
import {
	ContributionTimelineSkeleton,
	DomainDashboardGridSkeleton,
	RadialActivityChartSkeleton,
	TodayRecapCardSkeleton,
} from "./Skeletons";

function TopSectionSkeleton() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
			<TodayRecapCardSkeleton />
			<RadialActivityChartSkeleton />
		</div>
	);
}

function TopSectionContent({ data }: { data: DashboardOverviewData }) {
	const targetNotes = 20;
	const targetDrafts = 5;
	const notePct = Math.min(100, (data.noteCount7d / targetNotes) * 100);
	const draftPct = Math.min(100, (data.draftCount7d / targetDrafts) * 100);
	const r1 = 64;
	const c1 = 2 * Math.PI * r1;
	const offset1 = c1 - (notePct / 100) * c1;
	const r2 = 48;
	const c2 = 2 * Math.PI * r2;
	const offset2 = c2 - (draftPct / 100) * c2;

	const recentItems = [
		...data.recentNotes.map((n) => ({
			id: n.id,
			type: "note" as const,
			title: n.url_pattern || "Note",
			content: n.content || "",
			isResolved: n.is_resolved,
			href: buildNoteContextHref({
				id: n.id,
				scope: n.scope,
				url_pattern: n.url_pattern,
			}),
			createdAt: n.created_at,
		})),
		...data.recentDrafts.map((d) => ({
			id: d.id,
			type: "draft" as const,
			title: d.title || "Untitled Draft",
			content: d.content || "",
			isResolved: false,
			href: `/studio/${d.id}`,
			createdAt: d.created_at,
		})),
	]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, 5);

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
			{/* Today's Focus */}
			<div className="flex flex-col justify-between items-center p-5 rounded-xl bg-base-surface border border-base-border h-full min-h-[340px] md:min-h-[320px]">
				<div className="flex justify-between items-start w-full">
					<span className="text-[10px] uppercase tracking-wider text-neutral-400 font-mono">
						Today's Focus
					</span>
					<CustomLink
						className="p-1.5 text-neutral-400 hover-safe:text-action hover-safe:bg-neutral-100 rounded-full transition-colors"
						href={`/notes?view=diaries&year=${data.currentYear}&month=${data.currentMonth}`}
						title="View Diaries Timeline"
					>
						<CalendarDays aria-hidden="true" className="w-4 h-4" />
					</CustomLink>
				</div>
				<div className="flex flex-col items-center gap-4 my-4 flex-1">
					<CustomLink
						className="relative w-24 h-28 md:w-20 md:h-24 lg:w-28 lg:h-32 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-base-border/60 overflow-hidden flex flex-col items-center select-none shrink-0 hover:scale-102 transition-transform cursor-pointer group/box"
						href={`/diaries/${data.todayStr}`}
					>
						<div className="w-full bg-action py-1 text-center text-[9px] font-bold tracking-wider text-white font-mono">
							{data.monthYearStr}
						</div>
						<div className="flex-1 flex items-center justify-center">
							<span className="text-5xl font-black tracking-tighter text-neutral-900 dark:text-neutral-100 font-mono">
								{data.dayNumStr}
							</span>
						</div>
						<div className="w-full text-center pb-1.5 text-[9px] font-bold tracking-widest text-neutral-400 font-mono">
							{data.weekdayStr}
						</div>
					</CustomLink>
					<AppendDiaryButton />
					<div className="flex flex-col justify-center items-center text-center mt-2">
						<div className="flex items-baseline gap-1">
							<span className="text-4xl font-black tracking-tighter text-action drop-shadow-sm font-mono">
								{data.todayTotal}
							</span>
							<span className="text-xs text-neutral-400 font-bold font-mono">
								new entries today
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Weekly Progress */}
			<div className="flex flex-col gap-6 p-6 rounded-xl border border-base-border md:col-span-2 h-full justify-between">
				<div className="flex flex-col md:flex-row items-center gap-6 flex-1 my-auto">
					<div className="relative w-32 h-32 flex items-center justify-center shrink-0">
						<svg
							className="w-full h-full transform -rotate-90"
							viewBox="0 0 160 160"
							aria-label="Weekly activity circular progress chart"
							role="img"
						>
							<circle
								cx="80"
								cy="80"
								r={r1}
								className="stroke-neutral-100 dark:stroke-neutral-800"
								strokeWidth="8"
								fill="transparent"
							/>
							<circle
								cx="80"
								cy="80"
								r={r1}
								stroke="var(--color-note-info)"
								strokeWidth="8"
								fill="transparent"
								strokeDasharray={c1}
								strokeDashoffset={offset1}
								strokeLinecap="round"
								className="transition-all duration-500 ease-out"
							/>
							<circle
								cx="80"
								cy="80"
								r={r2}
								className="stroke-neutral-100 dark:stroke-neutral-800"
								strokeWidth="8"
								fill="transparent"
							/>
							<circle
								cx="80"
								cy="80"
								r={r2}
								stroke="var(--color-note-idea)"
								strokeWidth="8"
								fill="transparent"
								strokeDasharray={c2}
								strokeDashoffset={offset2}
								strokeLinecap="round"
								className="transition-all duration-500 ease-out"
							/>
						</svg>
						<div className="absolute flex flex-col items-center justify-center text-center">
							<span className="text-2xl font-bold tracking-tight text-action">
								{data.noteCount7d + data.draftCount7d}
							</span>
							<span className="text-[8px] uppercase tracking-wider text-neutral-500 font-mono">
								Activities
							</span>
						</div>
					</div>
					<div className="flex-1 flex flex-col justify-center gap-4 w-full">
						<div>
							<h3 className="text-xl font-bold text-action">Weekly Progress</h3>
							<p className="text-xs text-neutral-500 mt-0.5">
								Your note-taking activity over the last 7 days.
							</p>
						</div>
						<div className="flex flex-col gap-3">
							<div className="flex items-center justify-between text-xs">
								<div className="flex items-center gap-2">
									<div className="w-2.5 h-2.5 rounded-full bg-note-info shrink-0" />
									<FileText
										aria-hidden="true"
										className="w-3.5 h-3.5 text-neutral-500"
									/>
									<span className="font-medium text-action">
										Notes Captured
									</span>
								</div>
								<div className="font-mono text-neutral-600 font-bold text-sm">
									{data.noteCount7d}
								</div>
							</div>
							<div className="flex items-center justify-between text-xs">
								<div className="flex items-center gap-2">
									<div className="w-2.5 h-2.5 rounded-full bg-note-idea shrink-0" />
									<Edit3
										aria-hidden="true"
										className="w-3.5 h-3.5 text-neutral-500"
									/>
									<span className="font-medium text-action">
										Drafts Created
									</span>
								</div>
								<div className="font-mono text-neutral-600 font-bold text-sm">
									{data.draftCount7d}
								</div>
							</div>
						</div>
					</div>
				</div>
				{recentItems.length > 0 && (
					<div className="pt-4 border-t border-base-border/60 flex flex-col gap-2 w-full min-w-0 shrink-0">
						<span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
							Recent Items
						</span>
						<div className="flex flex-col gap-1.5 w-full min-w-0">
							{recentItems.map((item) => (
								<Link
									className="grid grid-cols-[14px_minmax(0,1fr)] gap-2 items-center text-xs text-neutral-600 hover-safe:text-action transition-colors w-full min-w-0"
									href={item.href}
									key={item.id}
								>
									<div className="shrink-0">
										{item.type === "note" ? (
											<FileText
												aria-hidden="true"
												className="w-3.5 h-3.5 text-neutral-400"
											/>
										) : (
											<Edit3
												aria-hidden="true"
												className="w-3.5 h-3.5 text-neutral-400"
											/>
										)}
									</div>
									<span
										className={`truncate font-sans ${item.isResolved ? "line-through opacity-50" : ""}`}
										title={item.content || item.title}
									>
										{item.content
											? item.content.replace(/[#*`-]/g, "")
											: item.title}
									</span>
								</Link>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function TopSectionSlot({
	data,
	isLoading,
}: {
	data: DashboardOverviewData | undefined;
	isLoading: boolean;
}) {
	return (
		<Suspense fallback={<TopSectionSkeleton />}>
			<SWRBoundary
				data={data}
				fallback={<TopSectionSkeleton />}
				isLoading={isLoading}
			>
				{(resolvedData) => <TopSectionContent data={resolvedData} />}
			</SWRBoundary>
		</Suspense>
	);
}

function DomainActivityContent({
	domainActivities,
}: {
	domainActivities: DashboardOverviewData["domainActivities"];
}) {
	if (domainActivities.length === 0) {
		return (
			<div className="rounded-xl border border-dashed border-base-border p-8 text-center text-sm text-neutral-500">
				No active domain tracking detected. Capture notes via Extension to build
				domain activity.
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
			{domainActivities.map((act) => (
				<DomainDashboardCard data={act} key={act.domain} />
			))}
		</div>
	);
}

function DomainActivitySlot({
	data,
	isLoading,
}: {
	data: DashboardOverviewData | undefined;
	isLoading: boolean;
}) {
	return (
		<Suspense fallback={<DomainDashboardGridSkeleton />}>
			<SWRBoundary
				data={data}
				fallback={<DomainDashboardGridSkeleton />}
				isLoading={isLoading}
			>
				{(resolvedData) => (
					<DomainActivityContent
						domainActivities={resolvedData.domainActivities}
					/>
				)}
			</SWRBoundary>
		</Suspense>
	);
}

function ActivityLogSlot({
	data,
	isLoading,
}: {
	data: DashboardOverviewData | undefined;
	isLoading: boolean;
}) {
	return (
		<Suspense fallback={<ContributionTimelineSkeleton />}>
			<SWRBoundary
				data={data}
				fallback={<ContributionTimelineSkeleton />}
				isLoading={isLoading}
			>
				{(resolvedData) => (
					<ContributionTimeline
						drafts={resolvedData.drafts7d}
						notes={resolvedData.notes7d}
					/>
				)}
			</SWRBoundary>
		</Suspense>
	);
}

export function DashboardContainer() {
	const { data, isLoading } = useFetchDashboardData();

	return (
		<div className="flex-1 bg-base-bg text-action font-sans overflow-y-auto">
			<div className="mx-auto px-4 py-8 md:px-6 md:py-12 flex flex-col gap-12">
				{/* Top Section Slot */}
				<section>
					<TopSectionSlot data={data} isLoading={isLoading} />
				</section>

				{/* Domain Activity Section (0ms 常時表示見出し + 局所保護スロット) */}
				<section>
					<div className="flex items-center gap-2 mb-6">
						<Layers aria-hidden="true" className="w-5 h-5 text-neutral-400" />
						<h2 className="text-3xl font-bold tracking-tight text-action">
							Domain Activity
						</h2>
					</div>
					<DomainActivitySlot data={data} isLoading={isLoading} />
				</section>

				{/* Activity Log Section (0ms 常時表示見出し + 局所保護スロット) */}
				<section className="pb-8">
					<div className="flex items-center gap-2 mb-6">
						<Activity aria-hidden="true" className="w-5 h-5 text-neutral-400" />
						<h2 className="text-3xl font-bold tracking-tight text-action">
							Activity Log
						</h2>
					</div>
					<ActivityLogSlot data={data} isLoading={isLoading} />
				</section>
			</div>
		</div>
	);
}
