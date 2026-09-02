import { getMatchingNoteCount, getScopeUrls, type Note } from "@sitecue/shared";
import { supabase } from "../src/supabaseClient";

export default defineBackground(() => {
	// --- ここに元々の background.ts の中身をそのまま配置 ---
	// 例:
	// chrome.sidePanel.setPanelBehavior({ openPanelOnActionIconClick: true });
	// chrome.tabs.onUpdated.addListener(...) など
	// Enable side panel on action click
	chrome.sidePanel
		.setPanelBehavior({ openPanelOnActionClick: true })
		.catch((error: unknown) => console.error(error));

	console.log("sitecue background script loaded.");

	// --- Helper Functions ---

	async function updateBadge(tabId: number, url: string) {
		// 🛡️ URL生存チェック＆特殊URL（chrome://等）の物理防御壁
		if (!url?.startsWith("http")) {
			await chrome.action.setBadgeText({ tabId, text: "" });
			return;
		}

		// ⚡ レースコンディション安全装置 (50ms ディレイ)
		// UI側の非同期ストレージ書き込み（伝播）が 100% 完了するのを確実に待つ
		await new Promise((resolve) => setTimeout(resolve, 50));

		// 1. ゲストフラグおよびゲストメモの安全な非同期フェッチ
		const storageRes = await chrome.storage.local.get([
			"sitecue_guest_mode",
			"sitecue_guest_notes",
		]);
		const isGuestMode = storageRes.sitecue_guest_mode === true;

		if (isGuestMode) {
			const guestNotes = (storageRes.sitecue_guest_notes as Note[]) || [];

			// 2. 🛡️ インライン超軽量正規化 (ビットレベルでの文字列完全シンクロ防壁)
			// プロトコル (http://, https://) および www. 、末尾の / を確実に削ぎ落とす
			let cleanedUrl = url.replace(/^(https?:\/\/)?(www\.)?/, "");
			if (cleanedUrl.endsWith("/")) {
				cleanedUrl = cleanedUrl.slice(0, -1);
			}

			// ドメイン部分の切り出し (最初の / より前)
			const hostPart = url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
			const localDomainPattern = hostPart.replace(/^(www\.)?/, ""); // domain用
			const localExactPattern = cleanedUrl; // exact用

			// 3. 📋 タブスコープの厳格な隔離原則に基づくインメモリ消し込み
			const matchingGuestCount = guestNotes.filter((note) => {
				if (note.is_resolved) return false;

				// 💡 お気に入りの全タブ貫通ロジック（if (note.is_favorite === true) return true;）を物理削除
				// 100%文字レベルで一致するローカルコンテキストのみを正確に集計
				return (
					(note.scope === "domain" &&
						note.url_pattern === localDomainPattern) ||
					(note.scope === "exact" && note.url_pattern === localExactPattern)
				);
			}).length;

			// 4. バッジのテキストおよびカラーをアトミックに適用して早期リターン
			const countStr =
				matchingGuestCount > 0 ? matchingGuestCount.toString() : "";
			await chrome.action.setBadgeText({ tabId, text: countStr });

			if (matchingGuestCount > 0) {
				await chrome.action.setBadgeBackgroundColor({
					tabId,
					color: "#3B82F6", // セマンティックBlue
				});
				await chrome.action.setBadgeTextColor({ tabId, color: "#FFFFFF" });
			}
			return; // Supabaseへのオンライン通信を完全にバイパス
		}

		const { domain, exact } = getScopeUrls(url);

		try {
			const count = await getMatchingNoteCount(supabase, domain, exact);

			const countStr = count && count > 0 ? count.toString() : "";
			await chrome.action.setBadgeText({ tabId, text: countStr });
			if (count && count > 0) {
				await chrome.action.setBadgeBackgroundColor({
					tabId,
					color: "#3B82F6",
				}); // Blue
				await chrome.action.setBadgeTextColor({ tabId, color: "#FFFFFF" }); // White
			}
		} catch (err) {
			console.error("Unexpected error in updateBadge:", err);
			await chrome.action.setBadgeText({ tabId, text: "" });
		}
	}

	// --- Event Listeners ---

	// 1. Tab Activated (Switched)
	chrome.tabs.onActivated.addListener(async (activeInfo) => {
		try {
			const tab = await chrome.tabs.get(activeInfo.tabId);
			if (tab.url) {
				await updateBadge(activeInfo.tabId, tab.url);
			}
		} catch (error) {
			console.debug(
				"[sitecue] Tab closed or unavailable before badge update:",
				error,
			);
		}
	});

	// 2. Tab Updated (Navigated/Reloaded)
	chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
		// リロード時は changeInfo.url が undefined になるが、
		// Chromeがバッジをクリアしてしまうため status === "complete" で再描画する
		if (changeInfo.url || changeInfo.status === "complete") {
			if (tab.url) {
				await updateBadge(tabId, tab.url);
			}
		}
	});

	// 3. Message from Side Panel (Note created/deleted)
	chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		if (message.type === "REFRESH_BADGE") {
			// 非同期処理を即時実行関数（IIFE）でラップして実行
			(async () => {
				try {
					const tabs = await chrome.tabs.query({
						active: true,
						currentWindow: true,
					});
					if (tabs.length > 0 && tabs[0].id && tabs[0].url) {
						await updateBadge(tabs[0].id, tabs[0].url);
					}
					sendResponse({ status: "ok" });
				} catch (error) {
					console.error("[sitecue] Failed to refresh badge:", error);
					sendResponse({ status: "error", error });
				}
			})();

			// 非同期で sendResponse を呼ぶために true を返す (Manifest V3 必須)
			return true;
		}

		if (message.type === "TEST_SESSION_REFRESH") {
			// Trigger manual session refresh test
			// biome-ignore lint/suspicious/noExplicitAny: test hacking
			(self as any).testSessionRefresh?.();
			sendResponse({ status: "test_started" });
			return false; // Sync response
		}
	});

	// --- Session Auto-Refresh & Monitoring ---

	/**
	 * Checks if the current session is close to expiring (within 5 minutes)
	 * and refreshes it if necessary.
	 */
	async function checkSession() {
		console.log("[Session Check] Checking session status...");
		const {
			data: { session },
			error,
		} = await supabase.auth.getSession();

		if (error || !session) {
			console.log("[Session Check] No active session.");
			return;
		}

		const expiresAt = session.expires_at || 0; // unix timestamp in seconds
		const now = Math.floor(Date.now() / 1000);
		const timeRemaining = expiresAt - now;

		console.log(`[Session Check] Expires in: ${timeRemaining}s`);

		// If expires in less than 5 minutes (300s), refresh it
		if (timeRemaining < 300) {
			console.log("[Session Check] Session expiring soon... Refreshing...");
			const { data, error: refreshError } =
				await supabase.auth.refreshSession();

			if (refreshError) {
				console.error("[Session Check] Refresh failed:", refreshError);
			} else {
				console.log(
					"[Session Check] Session successfully refreshed!",
					data.session?.expires_at,
				);
			}
		}
	}

	// Monitor auth state changes (Logging)
	supabase.auth.onAuthStateChange((event, session) => {
		console.log(`[Auth Debug] Event: ${event}`);
		if (session) {
			const expiresAt = new Date(
				(session.expires_at || 0) * 1000,
			).toLocaleString();
			console.log(`[Auth Debug] Session expires at: ${expiresAt}`);
		}
	});

	// Run checkSession every 1 minute
	setInterval(checkSession, 60 * 1000);

	/**
	 * Manually trigger a session refresh test.
	 * call this from the DevTools console: chrome.runtime.sendMessage({ type: 'TEST_SESSION_REFRESH' })
	 */
	// biome-ignore lint/suspicious/noExplicitAny: test hacking
	(self as any).testSessionRefresh = async () => {
		console.log("[Test] Starting session refresh test...");

		const {
			data: { session },
			error,
		} = await supabase.auth.getSession();

		if (error || !session) {
			console.error("[Test] No active session to test with.", error);
			return;
		}

		// 1. Set a fake session that expires in 5 seconds
		const currentTimestamp = Math.floor(Date.now() / 1000);
		const newExpiresAt = currentTimestamp + 5;

		const fakeExpiringSession = {
			...session,
			expires_at: newExpiresAt,
			expires_in: 5,
		};

		console.log(
			`[Test] Setting local session to expire in 5 seconds (${new Date(newExpiresAt * 1000).toLocaleString()})...`,
		);

		// Apply the fake session locally
		const { error: setErrors } =
			await supabase.auth.setSession(fakeExpiringSession);

		if (setErrors) {
			console.error("[Test] Failed to set expiring session:", setErrors);
			return;
		}

		console.log("[Test] Wrapper session set. Waiting for auto-refresh...");

		// 2. Force the check to run after 6 seconds (to simulate the interval hitting)
		setTimeout(() => {
			console.log("[Test] 6 seconds passed. Forcing checkSession()...");
			checkSession();
		}, 6000);
	};
});
