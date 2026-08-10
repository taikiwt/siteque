const CACHE_NAME = "sitecue-app-shell-v6";
const STATIC_ASSETS = ["/logo.svg", "/icon.ico", "/apple-icon.png"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key)),
				),
			),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	if (!event.request.url.startsWith(self.location.origin)) {
		return;
	}

	if (event.request.method !== "GET") return;

	const url = new URL(event.request.url);

	// ★ 最優先バイパスルール: 画面遷移（HTML取得）および RSC / API / 認証通信は
	// SW で一切処理・横取りせず、100% サーバー (middleware.ts) へ直接到達させる。
	const isNavigation =
		event.request.mode === "navigate" ||
		event.request.headers.get("accept")?.includes("text/html");

	if (
		isNavigation ||
		url.searchParams.has("_rsc") ||
		url.pathname.startsWith("/api/") ||
		url.pathname.startsWith("/auth/") ||
		url.pathname.endsWith(".webmanifest")
	) {
		return;
	}

	// ロゴ・アイコン等の静的アセットのみ Cache-First で処理
	event.respondWith(
		caches
			.match(event.request)
			.then((cachedResponse) => {
				const fetchPromise = fetch(event.request)
					.then((networkResponse) => {
						if (networkResponse && networkResponse.status === 200) {
							const responseToCache = networkResponse.clone();
							caches.open(CACHE_NAME).then((cache) => {
								cache.put(event.request, responseToCache);
							});
						}
						return networkResponse;
					})
					.catch((_error) => {
						return cachedResponse || new Response("", { status: 504 });
					});

				return cachedResponse || fetchPromise;
			})
			.catch((_error) => {
				return new Response("", { status: 504 });
			}),
	);
});
