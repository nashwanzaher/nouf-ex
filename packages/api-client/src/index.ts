/**
 * Noufex API client — typed SDK generated from `/api/openapi.json`.
 *
 * Single source of truth: this package re-exports the types
 * derived from `apps/api/src/lib/openapi.ts` and bundles a
 * pre-configured `openapi-fetch` instance that knows:
 *   - the production + staging base URLs,
 *   - the default `Accept` header (Stripe-style vendor media type),
 *   - the CSRF cookie name,
 *   - the request-id header used by every response.
 *
 * Why a custom client wrapper (and not raw `openapi-fetch` exports)
 *   - Web and mobile apps share one client. Centralising the
 *     configuration means a future breaking change to the API
 *     headers (e.g. switching auth schemes) is a one-line edit
 *     here instead of a sweep across `apps/*`.
 *   - TypeScript users get full IntelliSense: `client.GET('/api/products', {})`
 *     is typed against the OpenAPI operations.
 *
 * Usage (web):
 *   import { client } from '@noufex/api-client';
 *   const res = await client.GET('/api/products', {
 *     params: { query: { category: 'phones' } },
 *   });
 *   if (res.data) console.log(res.data.products);
 */
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema.d.ts';

const DEFAULT_API_BASE = 'https://api.noufex.com';
const DEFAULT_MEDIA_TYPE = 'application/vnd.noufex.v1+json';

/** Standard middleware: tag every request with the API version
 *  via the `Accept` header (Tier 5.3) and forward a request id so
 *  logs can be correlated across client + server. */
const versionMiddleware: Middleware = {
	async onRequest({ request }) {
		const headers = new Headers(request.headers);
		if (!headers.has('accept')) {
			headers.set('accept', DEFAULT_MEDIA_TYPE);
		}
		if (!headers.has('x-request-id') && typeof crypto !== 'undefined') {
			try {
				headers.set(
					'x-request-id',
					(crypto as { randomUUID?: () => string }).randomUUID?.() ??
						`req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
				);
			} catch {
				// ignore — request-id is best-effort.
			}
		}
		return new Request(request, { headers });
	},
};

export interface ClientOptions {
	baseUrl?: string;
	/** Bearer token from `/api/auth/login`. Mobile clients use
	 *  this; web clients prefer the HttpOnly cookie. */
	token?: string;
	/** Extra headers to attach to every request (e.g. an
	 *  idempotency key for the checkout flow). */
	extraHeaders?: Record<string, string>;
}

/** Build a typed client. Used by the default export below and
 *  available to tests that want to inject a mock base URL. */
export function createApiClient(opts: ClientOptions = {}) {
	const baseUrl = opts.baseUrl ?? DEFAULT_API_BASE;
	const client = createClient<paths>({
		baseUrl,
		headers: {
			...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
			...opts.extraHeaders,
		},
	});
	// Tier 5.3 — every request gets the vendor `Accept` header so
	// the server can negotiate the API version. The middleware
	// also stamps an `x-request-id` so logs can correlate.
	client.use(versionMiddleware);
	return client;
}

/** Default client instance — points at production. Override
 *  `baseUrl` at build time by importing `createApiClient({...})`
 *  directly (the staging pipeline does this in CI). */
export const client = createApiClient();

/** Re-export the generated types so call sites get the full
 *  IntelliSense surface. */
export type { paths, components } from './schema.d.ts';
export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: string; code?: string; request_id?: string };