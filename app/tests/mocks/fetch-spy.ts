/**
 * tests/mocks/fetch-spy.ts — fetch interceptor for DOM tests.
 *
 * In a happy-dom environment, the standard `setupServer` from `msw/node`
 * does NOT intercept `window.fetch` (which bypasses Node's http module).
 * Instead, we patch `window.fetch` directly to dispatch to the same MSW
 * handler set. This keeps the handler definitions (handlers.ts) the
 * single source of truth for test data.
 *
 * Usage in a test file:
 *
 *   import { installFetchSpy, uninstallFetchSpy } from '../mocks/fetch-spy';
 *   beforeAll(() => installFetchSpy());
 *   afterAll(() => uninstallFetchSpy());
 */

import { handlers } from './handlers';
import productsFixture from './fixtures/products.json';
import categoriesFixture from './fixtures/categories.json';
import storesFixture from './fixtures/stores.json';
import statsFixture from './fixtures/stats.json';
import reviewsFixture from './fixtures/reviews.json';
import usersFixture from './fixtures/users.json';
import ordersFixture from './fixtures/orders.json';

type FetchArgs = Parameters<typeof fetch>;
type FetchInput = FetchArgs[0];
type FetchInit = FetchArgs[1];

let originalFetch: typeof fetch | null = null;

// Map from URL pattern → JSON fixture, used when the hook reads the
// build-time snapshot (e.g. /data/products.json) instead of /api/...
const staticData: Record<string, unknown> = {
	'/data/products.json': productsFixture,
	'/data/categories.json': categoriesFixture,
	'/data/stores.json': storesFixture,
	'/data/stats.json': statsFixture,
	'/data/reviews.json': reviewsFixture,
	'/data/users.json': usersFixture,
	'/data/orders.json': ordersFixture,
};

export function installFetchSpy(): void {
	if (originalFetch) return; // idempotent

	originalFetch = globalThis.fetch.bind(globalThis);

	globalThis.fetch = async (input: FetchInput, init?: FetchInit): Promise<Response> => {
		const req =
			input instanceof Request
				? input
				: new Request(typeof input === 'string' ? input : (input as URL).toString(), init);
		const url = req.url;

		// 1. Static JSON snapshot — return the matching fixture.
		const pathname = new URL(url, 'http://x').pathname;
		if (pathname in staticData) {
			return new Response(JSON.stringify(staticData[pathname]), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		}

		// 2. Dynamic API — try the MSW handlers.
		for (const h of handlers as unknown as Array<{
			method?: string;
			path: string | RegExp;
			handler: (ctx: { request: Request }) => Promise<Response> | Response;
		}>) {
			// MSW path can be a string template, regex, or wildcard. We do a
			// loose match on the URL.
			const url = req.url;
			let matches = false;
			if (typeof h.path === 'string') {
				// h.path is something like '*/api/categories' or '/api/categories'
				const pattern = h.path.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
				matches = new RegExp('^' + pattern + '$').test(url);
			} else if (h.path instanceof RegExp) {
				matches = h.path.test(url);
			}
			if (!matches) continue;
			if (h.method && req.method !== h.method.toUpperCase()) continue;

			try {
				const res = await h.handler({ request: req });
				return res;
			} catch (err) {
				return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
					status: 500,
					headers: { 'content-type': 'application/json' },
				});
			}
		}

		// Unhandled request — fail loudly so we don't get silent fall-throughs.
		throw new Error(`[fetch-spy] Unhandled ${req.method} ${req.url}`);
	};
}

export function uninstallFetchSpy(): void {
	if (!originalFetch) return;
	globalThis.fetch = originalFetch;
	originalFetch = null;
}

export function resetFetchSpy(): void {
	// Clear any per-test state (none today, but exposes the seam).
}
