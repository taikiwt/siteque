import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardDomainActivity, Note, NoteMetadata } from "../types/app";
import { type CreateNoteInput, resolveNotePayload } from "../utils/notes";
import { extractTags } from "../utils/tags";
import { normalizeUrl } from "../utils/url";

/**
 * ノート一覧のメタデータを取得する (Slim Fetching)
 */
export async function fetchNoteMetadatas(
	supabase: SupabaseClient,
	userId: string,
): Promise<NoteMetadata[]> {
	const { data, error } = await supabase
		.from("sitecue_notes")
		.select(
			"id, user_id, url_pattern, scope, note_type, is_pinned, is_resolved, is_favorite, is_expanded, sort_order, created_at, updated_at, draft_id, tags",
		)
		.eq("user_id", userId)
		.order("is_pinned", { ascending: false })
		.order("sort_order", { ascending: true })
		.order("created_at", { ascending: false });

	if (error) throw error;
	return (data as NoteMetadata[]) || [];
}

export async function createNoteEntity(
	supabase: SupabaseClient,
	userId: string,
	input: CreateNoteInput,
): Promise<Note> {
	const payload = resolveNotePayload(input);

	// 未ピン留めノートの中から最も若い（最小の）sort_orderを取得する
	const { data: existingNotes, error: fetchError } = await supabase
		.from("sitecue_notes")
		.select("sort_order")
		.eq("user_id", userId)
		.eq("scope", payload.scope)
		.eq("is_pinned", false)
		.order("sort_order", { ascending: true })
		.limit(1);

	if (fetchError) throw fetchError;

	let newSortOrder = 0.0;
	if (existingNotes && existingNotes.length > 0) {
		// 最小値からさらに -1.0 減算することで、ピン留め直下の最上部に差し込む若い値を採番
		newSortOrder = existingNotes[0].sort_order - 1.0;
	} else {
		// 未ピン留めノートが存在しない場合は、全ノートの最小値を取得して基準とする
		const { data: allNotes, error: allFetchError } = await supabase
			.from("sitecue_notes")
			.select("sort_order")
			.eq("user_id", userId)
			.eq("scope", payload.scope)
			.order("sort_order", { ascending: true })
			.limit(1);

		if (allFetchError) throw allFetchError;
		newSortOrder =
			allNotes && allNotes.length > 0 ? allNotes[0].sort_order - 1.0 : 0.0;
	}

	const insertData = {
		user_id: userId,
		url_pattern: payload.url_pattern,
		content: payload.content,
		scope: payload.scope,
		note_type: payload.note_type,
		tags: payload.tags,
		sort_order: newSortOrder,
		is_expanded: false,
		is_favorite: false,
		is_pinned: false,
		is_resolved: false,
	};

	const { data, error } = await supabase
		.from("sitecue_notes")
		.insert(insertData)
		.select()
		.single();

	if (error) throw error;
	return data as Note;
}

/**
 * ノートを更新する
 */
export async function updateNoteEntity(
	supabase: SupabaseClient,
	id: string,
	updates: {
		content?: string;
		note_type?: Note["note_type"];
		scope?: Note["scope"];
		currentUrl?: string;
		is_resolved?: boolean;
		is_pinned?: boolean;
		is_favorite?: boolean;
		is_expanded?: boolean;
		sort_order?: number;
	},
): Promise<Note> {
	const updatePayload: Record<string, unknown> = {};

	if (updates.content !== undefined) {
		const trimmed = updates.content.trim();
		updatePayload.content = trimmed;
		updatePayload.tags = extractTags(trimmed);
	}

	if (updates.note_type !== undefined) {
		updatePayload.note_type = updates.note_type;
	}

	if (updates.scope !== undefined) {
		updatePayload.scope = updates.scope;
		if (updates.scope === "inbox" || updates.scope === "draft") {
			updatePayload.url_pattern = updates.scope;
		} else if (updates.currentUrl) {
			updatePayload.url_pattern = normalizeUrl(
				updates.currentUrl,
				updates.scope,
			);
		}
	}

	if (updates.is_resolved !== undefined)
		updatePayload.is_resolved = updates.is_resolved;
	if (updates.is_pinned !== undefined)
		updatePayload.is_pinned = updates.is_pinned;
	if (updates.is_favorite !== undefined)
		updatePayload.is_favorite = updates.is_favorite;
	if (updates.is_expanded !== undefined)
		updatePayload.is_expanded = updates.is_expanded;
	if (updates.sort_order !== undefined)
		updatePayload.sort_order = updates.sort_order;

	const { data, error } = await supabase
		.from("sitecue_notes")
		.update(updatePayload)
		.eq("id", id)
		.select()
		.single();

	if (error) throw error;
	return data as Note;
}

/**
 * ノート本文をまとめて取得する (Hydration用)
 */
export async function fetchNoteContents(
	supabase: SupabaseClient,
	ids: string[],
): Promise<{ id: string; content: string }[]> {
	if (ids.length === 0) return [];
	const { data, error } = await supabase
		.from("sitecue_notes")
		.select("id, content")
		.in("id", ids);

	if (error) throw error;
	return data || [];
}

/**
 * バッジ表示用の未解決ノートカウントを取得する
 */
export async function getMatchingNoteCount(
	supabase: SupabaseClient,
	domain: string,
	exact: string,
): Promise<number> {
	const { data, error } = await supabase.rpc("get_matching_active_note_count", {
		p_domain: domain,
		p_exact: exact,
	});

	if (error) throw error;
	return (data as number) || 0;
}

/**
 * ノートを削除する (単一)
 */
export async function deleteNoteEntity(
	supabase: SupabaseClient,
	id: string,
): Promise<string> {
	const { error } = await supabase.from("sitecue_notes").delete().eq("id", id);
	if (error) throw error;
	return id;
}

/**
 * ノートを削除する (複数)
 */
export async function deleteNotesEntity(
	supabase: SupabaseClient,
	ids: string[],
): Promise<string[]> {
	if (ids.length === 0) return [];
	const { error } = await supabase.from("sitecue_notes").delete().in("id", ids);
	if (error) throw error;
	return ids;
}

/**
 * URLパターンでノートを取得する (API用)
 */
export async function fetchNotesByUrlPattern(
	supabase: SupabaseClient,
	urlPattern?: string,
): Promise<Note[]> {
	let query = supabase.from("sitecue_notes").select("*");
	if (urlPattern) {
		query = query.eq("url_pattern", urlPattern);
	}
	const { data, error } = await query;
	if (error) throw error;
	return data as Note[];
}

/**
 * 拡張機能用のノートメタデータ一覧を取得する
 */
export async function fetchExtensionNoteMetadatas(
	supabase: SupabaseClient,
	scopeUrls: { domain: string; exact: string },
): Promise<Note[]> {
	const { data, error } = await supabase
		.from("sitecue_notes")
		.select(
			"id, user_id, url_pattern, scope, note_type, sort_order, created_at, is_expanded, is_favorite, is_pinned, is_resolved, tags",
		)
		.or(
			`and(url_pattern.eq."${scopeUrls.domain}",scope.eq.domain),and(url_pattern.eq."${scopeUrls.exact}",scope.eq.exact),scope.eq.inbox,is_favorite.eq.true`,
		)
		.order("sort_order", { ascending: true })
		.order("created_at", { ascending: true });

	if (error) throw error;
	return data as Note[];
}

/**
 * 拡張機能用のノート本文をHydration取得する
 */
export async function fetchExtensionNoteContents(
	supabase: SupabaseClient,
	scopeUrls: { domain: string; exact: string },
): Promise<{ id: string; content: string }[]> {
	const { data, error } = await supabase
		.from("sitecue_notes")
		.select("id, content")
		.or(
			`and(url_pattern.eq."${scopeUrls.domain}",scope.eq.domain),and(url_pattern.eq."${scopeUrls.exact}",scope.eq.exact),scope.eq.inbox,is_favorite.eq.true`,
		);

	if (error) throw error;
	return data || [];
}

/**
 * ノート数が多い上位ドメインのアクティビティを取得する (RSC用)
 */
export async function fetchTopDomainActivity(
	supabase: SupabaseClient,
	userId: string,
	limit = 6,
): Promise<{ domain: string; noteCount: number }[]> {
	const { data, error } = await supabase
		.from("sitecue_notes")
		.select("url_pattern")
		.eq("user_id", userId)
		.eq("scope", "domain");

	if (error) throw error;
	if (!data) return [];

	const counts: Record<string, number> = {};
	for (const row of data) {
		if (row.url_pattern) {
			counts[row.url_pattern] = (counts[row.url_pattern] || 0) + 1;
		}
	}

	return Object.entries(counts)
		.map(([domain, count]) => ({ domain, noteCount: count }))
		.sort((a, b) => b.noteCount - a.noteCount)
		.slice(0, limit);
}

/**
 * ダッシュボード用のドメインアクティビティを一括取得する (RSC用)
 * N+1クエリを回避し、単一のRPCで取得する。
 */
export async function fetchDashboardDomainActivity(
	supabase: SupabaseClient,
	userId: string,
	limit = 6,
): Promise<DashboardDomainActivity[]> {
	const { data, error } = await supabase.rpc("get_dashboard_domain_activity", {
		p_user_id: userId,
		p_limit: limit,
	});
	if (error) throw error;
	return (data as DashboardDomainActivity[]) || [];
}
