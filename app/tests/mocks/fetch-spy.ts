/**
 * tests/mocks/fetch-spy.ts — fetch interceptor for DOM tests.
 *
 * In a happy-dom environment, the standard `setupServer` from `msw/node`
 * does NOT intercept `window.fetch` (which bypasses Node's http module).
 * Instead, we patch `window.fetch` directly to dispatch to a small in-memory
 * mock table. This keeps the handler definitions (handlers.ts) the
 * single source of truth for test data.
 *
 * Two URL spaces are mocked:
 *   1. Static JSON snapshot — `/data/*.json` returns the matching fixture.
 *   2. Dynamic API        — `/api/*` is routed through the MSW handler
 *      set. We invoke each handler's `test()` and `run()` (or
 *      `resolver()` as a fallback) directly so we do not need the
 *      `msw/node` interceptor (which would not see `window.fetch`).
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

// Map from URL path → JSON fixture, used when the hook reads the
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
		const pathname = new URL(url, 'http://x').pathname;

		// 1. Static JSON snapshot — return the matching fixture.
		if (pathname in staticData) {
			return new Response(JSON.stringify(staticData[pathname]), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		}

		// 2. Dynamic API — route through the MSW handlers. We use our
		//    own URL matcher (matchesPath below) because MSW's test()
		//    performs loose matching that can match `*/api/categories`
		//    against `/api/stats/home`. We then invoke run() and fall
		//    back to resolver() when run() returns null (which can
		//    happen when invoked outside the MSW interceptor context).
		for (const h of handlers) {
			const mswHandler = h as unknown as {
				info?: { method?: string; path?: string | RegExp };
				run?: (a: { request: Request }) => Promise<unknown>;
				resolver?: (a: { request: Request }) => Promise<unknown> | unknown;
			};
			const methodOk = !mswHandler.info?.method || mswHandler.info.method === req.method;
			if (!methodOk) continue;
			if (!matchesPath(mswHandler.info?.path, url)) continue;

			try {
				// Calling handler.run() outside the MSW interceptor
				// returns a parsedResult object (not a Response), so we
				// call the resolver directly. The MSW resolvers return
				// `HttpResponse.json(...)` which is a Response.
				let result: unknown;
				if (typeof mswHandler.resolver === 'function') {
					result = await mswHandler.resolver({ request: req });
				} else if (typeof mswHandler.run === 'function') {
					result = await mswHandler.run({ request: req });
				}
				return await toResponse(result);
			} catch (err) {
				return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
					status: 500,
					headers: { 'content-type': 'application/json' },
				});
			}
		}

		// Unhandled request — fail loudly so we do not get silent fall-throughs.
		throw new Error(`[fetch-spy] Unhandled ${req.method} ${req.url}`);
	};
}

// Loose match for an MSW path pattern (e.g. `*/api/categories` or
// `/api/categories/:id`) against a request URL.
//
// MSW patterns are loose wildcards. We treat `*` as "any run of
// characters except `/`" (so `*/api/categories` does not match
// `/api/stats/home`) and require the path segments to match exactly,
// so `*/api/products` does NOT match `/api/products/1` (which should
// be handled by the `*/api/products/:id` pattern).
function matchesPath(pattern: string | RegExp | undefined, url: string): boolean {
	if (!pattern) return false;
	if (pattern instanceof RegExp) return pattern.test(url);
	// Extract the pathname from the URL, dropping the protocol/host.
	let pathname: string;
	try {
		pathname = new URL(url).pathname;
	} catch {
		pathname = url;
	}
	// Strip the query string.
	const qIdx = pathname.indexOf('?');
	if (qIdx >= 0) pathname = pathname.slice(0, qIdx);

	// Split pattern and pathname into segments and match segment by
	// segment. `*` matches zero-or-more characters within a single
	// segment (does not cross `/`).
	const patternSegments = pattern.split('/');
	const pathSegments = pathname.split('/');
	if (patternSegments.length !== pathSegments.length) return false;
	for (let i = 0; i < patternSegments.length; i++) {
		const ps = patternSegments[i];
		const ts = pathSegments[i];
		if (ps === '*') continue; // matches any single segment
		if (ps.startsWith(':')) continue; // matches any single segment
		if (ps !== ts) return false;
	}
	return true;
}

// Coerce whatever the MSW resolver produced into a Response. The MSW
// handlers typically return HttpResponse.json(...) which is already a
// Response. When invoked outside the interceptor, the result may be
// null/undefined; we fall back to wrapping the value in a success
// envelope so apiRequest does not have to special-case anything.
async function toResponse(value: unknown): Promise<Response> {
	if (value instanceof Response) {
		// Read+re-emit the body so callers can read .json() on the new
		// response (the original body stream can only be consumed once).
		const cloned = value.clone();
		const text = await cloned.text();
		return new Response(text, {
			status: value.status,
			statusText: value.statusText,
			headers: value.headers,
		});
	}
	// handler.run() may return a parsedResult-shaped object. Extract
	// the response body (which is the JSON the resolver produced) and
	// wrap it in a fresh Response.
	if (
		value &&
		typeof value === 'object' &&
		'response' in value &&
		(value as { response: Response }).response instanceof Response
	) {
		const innerResponse = (value as { response: Response }).response;
		const text = await innerResponse.clone().text();
		return new Response(text, {
			status: innerResponse.status,
			statusText: innerResponse.statusText,
			headers: innerResponse.headers,
		});
	}
	const v = value as { status?: number; body?: unknown; headers?: HeadersInit } | null | undefined;
	if (v && typeof v === 'object' && 'body' in v) {
		return new Response(typeof v.body === 'string' ? v.body : JSON.stringify(v.body), {
			status: v.status ?? 200,
			headers: v.headers as HeadersInit | undefined,
		});
	}
	// Last resort -- wrap in a success envelope.
	return new Response(JSON.stringify({ success: true, data: value ?? null }), {
		status: 200,
		headers: { 'content-type': 'application/json' },
	});
}

export function uninstallFetchSpy(): void {
	if (!originalFetch) return;
	globalThis.fetch = originalFetch;
	originalFetch = null;
}

export function resetFetchSpy(): void {
	// Clear any per-test state (none today, but exposes the seam).
}
