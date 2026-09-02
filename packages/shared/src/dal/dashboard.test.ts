import { describe, expect, it, vi } from "vitest";
import { fetchDashboardOverviewData } from "./dashboard";

describe("fetchDashboardOverviewData DAL", () => {
	it("7日間のデータが5件以上ある場合、追加フェッチなしでインメモリからrecentNotes/recentDraftsを抽出すること", async () => {
		const mockNotes7d = Array.from({ length: 6 }, (_, i) => ({
			id: `n-${i}`,
			content: `Note ${i}`,
			is_resolved: false,
			scope: "inbox",
			url_pattern: "inbox",
			created_at: new Date(Date.now() - i * 1000).toISOString(),
			note_type: "info",
		}));

		const mockDrafts7d = Array.from({ length: 6 }, (_, i) => ({
			id: `d-${i}`,
			title: `Draft ${i}`,
			content: `Content ${i}`,
			created_at: new Date(Date.now() - i * 1000).toISOString(),
		}));

		const mockFrom = vi.fn().mockImplementation((table) => {
			if (table === "sitecue_notes") {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							gte: vi.fn().mockImplementation((_, dateVal) => {
								if (
									typeof dateVal === "string" &&
									dateVal.includes("T00:00:00")
								) {
									return Promise.resolve({ count: 1, error: null });
								}
								return {
									order: vi.fn().mockResolvedValue({
										data: mockNotes7d,
										error: null,
									}),
								};
							}),
						}),
					}),
				};
			}
			if (table === "sitecue_drafts") {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							gte: vi.fn().mockImplementation((_, dateVal) => {
								if (
									typeof dateVal === "string" &&
									dateVal.includes("T00:00:00")
								) {
									return Promise.resolve({ count: 1, error: null });
								}
								return {
									order: vi.fn().mockResolvedValue({
										data: mockDrafts7d,
										error: null,
									}),
								};
							}),
						}),
					}),
				};
			}
			return {};
		});

		const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
		const mockSupabase = {
			from: mockFrom,
			rpc: mockRpc,
		};

		const result = await fetchDashboardOverviewData(
			mockSupabase as unknown as Parameters<
				typeof fetchDashboardOverviewData
			>[0],
			"user-123",
		);

		expect(result.notes7d.length).toBe(6);
		expect(result.recentNotes.length).toBe(5);
		expect(result.recentNotes[0].id).toBe("n-0");
		expect(result.recentDrafts.length).toBe(5);
		expect(result.recentDrafts[0].id).toBe("d-0");
		// RPC呼び出しなしの確認
		expect(mockRpc).not.toHaveBeenCalledWith(
			"get_user_contribution_activity",
			expect.anything(),
		);
	});

	it("7日間のデータが5件未満の場合、フォールバックとして全期間の直近5件を取得すること", async () => {
		const mockNotes7d = [
			{
				id: "n-0",
				content: "Note 0",
				is_resolved: false,
				scope: "inbox",
				url_pattern: "inbox",
				created_at: new Date().toISOString(),
				note_type: "info",
			},
		];

		const mockFallbackNotes = Array.from({ length: 5 }, (_, i) => ({
			id: `fb-n-${i}`,
			content: `Fallback Note ${i}`,
			is_resolved: false,
			scope: "inbox",
			url_pattern: "inbox",
			created_at: new Date(Date.now() - (i + 10) * 86400000).toISOString(),
		}));

		const mockFrom = vi.fn().mockImplementation((table) => {
			if (table === "sitecue_notes") {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							gte: vi.fn().mockImplementation((_, dateVal) => {
								if (
									typeof dateVal === "string" &&
									dateVal.includes("T00:00:00")
								) {
									return Promise.resolve({ count: 1, error: null });
								}
								return {
									order: vi.fn().mockResolvedValue({
										data: mockNotes7d,
										error: null,
									}),
								};
							}),
							order: vi.fn().mockReturnValue({
								limit: vi.fn().mockResolvedValue({
									data: mockFallbackNotes,
									error: null,
								}),
							}),
						}),
					}),
				};
			}
			if (table === "sitecue_drafts") {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							gte: vi.fn().mockImplementation((_, dateVal) => {
								if (
									typeof dateVal === "string" &&
									dateVal.includes("T00:00:00")
								) {
									return Promise.resolve({ count: 0, error: null });
								}
								return {
									order: vi.fn().mockResolvedValue({
										data: [],
										error: null,
									}),
								};
							}),
							order: vi.fn().mockReturnValue({
								limit: vi.fn().mockResolvedValue({
									data: [],
									error: null,
								}),
							}),
						}),
					}),
				};
			}
			return {};
		});

		const mockSupabase = {
			from: mockFrom,
			rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
		};

		const result = await fetchDashboardOverviewData(
			mockSupabase as unknown as Parameters<
				typeof fetchDashboardOverviewData
			>[0],
			"user-123",
		);

		expect(result.notes7d.length).toBe(1);
		expect(result.recentNotes.length).toBe(5);
		expect(result.recentNotes[0].id).toBe("fb-n-0");
	});
});
