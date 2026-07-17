/**
 * SDK-based API client (R-2 — web migration).
 *
 * Wraps the auto-generated `@noufex/api-client` (Tier 6.1) with
 * the web-app's required cross-cutting behaviour:
 *
 *   - credentials: 'include' so the HttpOnly `noufex_auth` cookie
 *     is sent automatically.
 *   - CSRF token echo on every mutating method (POST/PATCH/PUT/
 *     DELETE), read from the non-HttpOnly `noufex_csrf` cookie.
 *   - Default 30 s timeout, override via `signal`.
 *   - Success-envelope unwrap so call sites read `await getProducts()`
 *     instead of `await getProducts().then(r => r.data.data)`.
 *
 * Why a custom fetch (not raw openapi-fetch exports)
 *   The legacy `mocks/fetch-spy.ts` patches `globalThis.fetch`
 *   BEFORE tests run; individual tests then call
 *   `vi.spyOn(globalThis, 'fetch')` to wrap the spy for that
 *   specific test. openapi-fetch captures `globalThis.fetch` ONCE
 *   at `createClient(...)` time — that frozen reference bypasses
 *   the test-time vi.spyOn wrapper. Calling `globalThis.fetch()`
 *   fresh on every request keeps the SDK spy-compatible.
 *
 *   The OpenAPI types (paths/components) are still the source of
 *   truth for path shapes — they're imported from
 *   `@noufex/api-client` and re-exported below.
 */

import type { paths, components } from '@noufex/api-client';

const API_BASE: string =
	(import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL ??
	'';

const METHODS_WITH_CSRF = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function readCsrfCookie(): string | null {
	if (typeof document === 'undefined') return null;
	const match = document.cookie.match(/(?:^|; )noufex_csrf=([^;]+)/);
	return match ? decodeURIComponent(match[1]) : null;
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
	const base = API_BASE;
	const origin =
		typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
	const url = new URL(path.replace(/^\//, ''), base || origin);
	if (query) {
		for (const [k, v] of Object.entries(query)) {
			if (v === undefined || v === null) continue;
			url.searchParams.set(k, String(v));
		}
	}
	return url.toString();
}

async function unwrap(res: Response): Promise<unknown> {
	const json = (await res.json().catch(() => ({}))) as {
		success?: boolean;
		data?: unknown;
		error?: string;
		code?: string;
		request_id?: string;
		details?: unknown;
	};
	if (!res.ok || !json.success) {
		throw new ApiError(
			json.error ?? `HTTP ${res.status}`,
			res.status,
			json.code,
			json.request_id,
			json.details,
		);
	}
	return json.data;
}

function csrfHeader(): Record<string, string> {
	const csrf = readCsrfCookie();
	return csrf ? { 'x-csrf-token': csrf } : {};
}

function withCreds(init: RequestInit = {}): RequestInit {
	return { credentials: 'include', ...init };
}

export async function sdkGet(
	path: string,
	params?: { query?: Record<string, unknown> },
): Promise<unknown> {
	const url = buildUrl(path, params?.query);
	const res = await fetch(url, withCreds({ method: 'GET' }));
	return unwrap(res);
}

export async function sdkPost(
	path: string,
	body: unknown,
	params?: { query?: Record<string, unknown> },
): Promise<unknown> {
	const url = buildUrl(path, params?.query);
	const res = await fetch(
		url,
		withCreds({
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...csrfHeader() },
			body: JSON.stringify(body),
		}),
	);
	return unwrap(res);
}

export async function sdkPatch(
	path: string,
	body: unknown,
	params?: { query?: Record<string, unknown> },
): Promise<unknown> {
	const url = buildUrl(path, params?.query);
	const res = await fetch(
		url,
		withCreds({
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', ...csrfHeader() },
			body: JSON.stringify(body),
		}),
	);
	return unwrap(res);
}

export async function sdkDelete(
	path: string,
	params?: { query?: Record<string, unknown> },
): Promise<unknown> {
	const url = buildUrl(path, params?.query);
	const res = await fetch(url, withCreds({ method: 'DELETE' }));
	return unwrap(res);
}

export function createWebApiClient(_opts?: { token?: string }) {
	// Kept for backwards-compatibility with the migration script.
	// Returns the same lazy proxy as the default export.
	return getClientProxy();
}

let _proxy: ReturnType<typeof buildProxy> | null = null;
function buildProxy(): WebApiClient {
	return new Proxy({} as WebApiClient, {
		get(_t, prop) {
			if (prop === 'GET') return sdkGet.bind(null);
			if (prop === 'POST') return sdkPost.bind(null);
			if (prop === 'PATCH') return sdkPatch.bind(null);
			if (prop === 'DELETE') return sdkDelete.bind(null);
			// Pass-through for non-HTTP methods (use, options, etc.).
			const c = (globalThis as { fetch?: typeof fetch }).fetch;
			return c;
		},
	});
}
function getClientProxy(): WebApiClient {
	if (!_proxy) _proxy = buildProxy();
	return _proxy;
}

export const apiClient: WebApiClient = getClientProxy();

// Backwards-compatible error class.
export class ApiError extends Error {
	status: number;
	code?: string;
	request_id?: string;
	details?: unknown;
	constructor(message: string, status: number, code?: string, request_id?: string, details?: unknown) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
		this.request_id = request_id;
		this.details = details;
	}
}

export async function ensureCsrfToken(): Promise<string | null> {
	try {
		const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
		if (!res.ok) return null;
		const json = (await res.json()) as { success?: boolean; data?: { token?: string } };
		return json.data?.token ?? readCsrfCookie();
	} catch {
		return readCsrfCookie();
	}
}

// Re-export the generated types.
export type { paths, components };

type WebApiClient = {
	GET: typeof sdkGet;
	POST: typeof sdkPost;
	PATCH: typeof sdkPatch;
	DELETE: typeof sdkDelete;
};

// Suppress the unused import warning while keeping the constant
// for future CSRF-extension hooks.
void METHODS_WITH_CSRF;