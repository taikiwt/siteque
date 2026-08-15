import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";
import "@testing-library/jest-dom";
expect.extend(matchers);

import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import React from "react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { handlers } from "./src/mocks/handlers";

// ResizeObserver mock
class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", {
	writable: true,
	value: ResizeObserver,
});

// PointerEvent mock (for jsdom)
if (!window.PointerEvent) {
	class PointerEvent extends MouseEvent {
		constructor(type: string, params: PointerEventInit = {}) {
			super(type, params);
		}
	}
	Object.defineProperty(window, "PointerEvent", {
		writable: true,
		value: PointerEvent,
	});
}

// matchMedia mock
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Supabase や Next.js のルーターなど、ブラウザ特有の機能をモック化
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
	useSearchParams: () => new URLSearchParams("url=example.com"),
}));

vi.mock("@/utils/supabase/client", () => ({
	createClient: () => ({
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: {
					session: { user: { id: "test-user" }, access_token: "fake-token" },
				},
				error: null,
			}),
		},
		from: vi.fn().mockReturnValue({
			select: vi.fn().mockReturnValue({
				eq: vi.fn().mockReturnValue({
					single: vi
						.fn()
						.mockResolvedValue({ data: { ai_usage_count: 0 }, error: null }),
				}),
			}),
		}),
	}),
}));

// Supabase Server の requireUser モック
vi.mock("@/utils/supabase/server", () => ({
	requireUser: vi.fn().mockResolvedValue({
		supabase: {},
		user: { id: "test-user" },
	}),
	createClient: vi.fn().mockResolvedValue({
		from: vi.fn().mockReturnThis(),
	}),
}));

// CodeMirrorの安全なモック化（getClientRectsクラッシュ防止）
vi.mock("@uiw/react-codemirror", () => {
	return {
		__esModule: true,
		default: vi.fn((props) => {
			return React.createElement("textarea", {
				"data-testid": "codemirror-mock",
				value: props.value,
				placeholder: props.placeholder,
				onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
					props.onChange?.(e.target.value),
			});
		}),
	};
});

// MSWサーバーの設定
export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	server.resetHandlers();
	cleanup();
	vi.clearAllMocks();
});

afterAll(() => server.close());
