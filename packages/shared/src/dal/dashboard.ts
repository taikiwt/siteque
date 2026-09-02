import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDashboardDomainActivity } from "./notes";

export interface DashboardOverviewData {
	todayTotal: number;
	todayStr: string;
	monthYearStr: string;
	dayNumStr: string;
	weekdayStr: string;
	currentYear: string;
	currentMonth: string;
	noteCount7d: number;
	draftCount7d: number;
	recentNotes: Array<{
		id: string;
		content: string | null;
		is_resolved: boolean;
		scope: "inbox" | "domain" | "exact";
		url_pattern: string;
		created_at: string;
	}>;
	recentDrafts: Array<{
		id: string;
		title: string | null;
		content: string | null;
		created_at: string;
	}>;
	domainActivities: Awaited<ReturnType<typeof fetchDashboardDomainActivity>>;
	notes7d: Array<{
		id: string;
		content: string | null;
		is_resolved: boolean;
		scope: "inbox" | "domain" | "exact";
		url_pattern: string;
		created_at: string;
		note_type: "info" | "alert" | "idea";
	}>;
	drafts7d: Array<{
		id: string;
		title: string | null;
		content: string | null;
		created_at: string;
	}>;
}

export async function fetchDashboardOverviewData(
	supabase: SupabaseClient,
	userId: string,
): Promise<DashboardOverviewData> {
	const d = new Date();
	const jstTime = d.getTime() + 9 * 60 * 60 * 1000;
	const jstDate = new Date(jstTime);
	const year = jstDate.getUTCFullYear();
	const month = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
	const day = String(jstDate.getUTCDate()).padStart(2, "0");
	const todayStr = `${year}-${month}-${day}`;
	const startOfDay = `${todayStr}T00:00:00+09:00`;

	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
	const dateStr = sevenDaysAgo.toISOString();

	// 重複クエリ（全期間のrecentNotes/recentDrafts）を排除し、初期並列クエリを5つに一元化
	const [
		{ count: todayNotes },
		{ count: todayDrafts },
		{ data: notes7dData },
		{ data: drafts7dData },
		domainActivities,
	] = await Promise.all([
		supabase
			.from("sitecue_notes")
			.select("*", { count: "exact", head: true })
			.eq("user_id", userId)
			.gte("created_at", startOfDay),
		supabase
			.from("sitecue_drafts")
			.select("*", { count: "exact", head: true })
			.eq("user_id", userId)
			.gte("created_at", startOfDay),
		supabase
			.from("sitecue_notes")
			.select(
				"id, content, is_resolved, scope, url_pattern, created_at, note_type",
			)
			.eq("user_id", userId)
			.gte("created_at", dateStr)
			.order("created_at", { ascending: false }),
		supabase
			.from("sitecue_drafts")
			.select("id, title, content, created_at")
			.eq("user_id", userId)
			.gte("created_at", dateStr)
			.order("created_at", { ascending: false }),
		fetchDashboardDomainActivity(supabase, userId, 6),
	]);

	const notes7d = (notes7dData as DashboardOverviewData["notes7d"]) ?? [];
	const drafts7d = (drafts7dData as DashboardOverviewData["drafts7d"]) ?? [];

	// 過去7日間のデータからインメモリで直近5件を取得
	let recentNotes: DashboardOverviewData["recentNotes"] = notes7d.slice(0, 5);
	// 過去7日間のデータが5件未満の場合は、全期間の直近5件をフォールバックフェッチ
	if (notes7d.length < 5) {
		const { data: fallbackNotes } = await supabase
			.from("sitecue_notes")
			.select("id, content, is_resolved, scope, url_pattern, created_at")
			.eq("user_id", userId)
			.order("created_at", { ascending: false })
			.limit(5);
		recentNotes = (fallbackNotes as DashboardOverviewData["recentNotes"]) ?? [];
	}

	let recentDrafts: DashboardOverviewData["recentDrafts"] = drafts7d.slice(
		0,
		5,
	);
	if (drafts7d.length < 5) {
		const { data: fallbackDrafts } = await supabase
			.from("sitecue_drafts")
			.select("id, title, content, created_at")
			.eq("user_id", userId)
			.order("created_at", { ascending: false })
			.limit(5);
		recentDrafts =
			(fallbackDrafts as DashboardOverviewData["recentDrafts"]) ?? [];
	}

	return {
		todayTotal: (todayNotes ?? 0) + (todayDrafts ?? 0),
		todayStr,
		monthYearStr: jstDate
			.toLocaleDateString("en-US", {
				month: "short",
				year: "numeric",
				timeZone: "UTC",
			})
			.toUpperCase(),
		dayNumStr: day,
		weekdayStr: jstDate
			.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
			.toUpperCase(),
		currentYear: year.toString(),
		currentMonth: month,
		noteCount7d: notes7d.length,
		draftCount7d: drafts7d.length,
		recentNotes,
		recentDrafts,
		domainActivities: domainActivities ?? [],
		notes7d,
		drafts7d,
	};
}
