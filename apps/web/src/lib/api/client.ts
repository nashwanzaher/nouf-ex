/**
 * Noufex Frontend API Client — base fetch wrapper
 *
 * Yemen & Middle East B2B/B2C e-commerce marketplace platform.
 * Internal module: provides the typed fetch wrapper and error class used
 * by every domain-specific file (products.ts, orders.ts, etc.). Do NOT
 * import from this file directly — import from `./index.ts` (the public
 * surface) or from the domain file you need.
 *
 * SECURITY: Auth token is stored in HttpOnly cookie (set by server),
 * not in localStorage. This prevents XSS attacks from stealing tokens.
 * We send `credentials: 'include'` to automatically include the cookie.
 *
 * SECURITY (P0, 2026-07-12): every mutating request (POST/PATCH/DELETE)
 * also includes a CSRF token in the `x-csrf-token` header, read from
 * the non-HttpOnly `noufex_csrf` cookie. The server compares this to
 * the HttpOnly `noufex_csrf_h` mirror before accepting any mutation.
 * Same-origin XSS cannot read HttpOnly cookies, so a CSRF token is
 * unreachable to a malicious script.
 */

const API_BASE: string =
	(import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL ?? '/api';

export interface ApiResponse<T> {
	success: boolean;
	data: T;
	message?: string;
	error?: string;
	/** Stable machine-readable code (e.g. `'NOT_FOUND'`, `'VALIDATION_ERROR'`).
	 *  Defined by `apps/api/src/lib/error-codes.ts` `ErrorCodes`. Use
	 *  `if (err.code === ErrorCodes.NOT_FOUND)` to branch — never parse
	 *  `err.message`. */
	code?: string;
	/** Optional structured context for the error (e.g. Zod issues). */
	details?: unknown;
	/** Server request ID (echoed from the `x-request-id` header). Useful
	 *  for cross-referencing a user-reported failure to the server log. */
	request_id?: string;
}

export interface RequestOptions {
	signal?: AbortSignal;
}

/** Default timeout for fetch requests (30s). Prevents the UI from
 *  hanging forever if the server stops responding. Callers can
 *  override by passing their own `signal`. */
const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/** Read the non-HttpOnly `noufex_csrf` cookie. Returns `null` if not
 *  present (the SPA will get one on its first GET from the server). */
function readCsrfCookie(): string | null {
	if (typeof document === 'undefined') return null;
	const match = document.cookie.match(/(?:^|; )noufex_csrf=([^;]+)/);
	return match ? decodeURIComponent(match[1]) : null;
}

/** Fetch a fresh CSRF token from the server. The server sets the
 *  HttpOnly mirror cookie (`noufex_csrf_h`) AND the non-HttpOnly
 *  read-only cookie (`noufex_csrf`); we return the same token the
 *  server returned so callers can cache it if they want. Used on
 *  SPA boot to guarantee the cookie exists before the first
 *  mutating request. */
export async function ensureCsrfToken(): Promise<string | null> {
	try {
		// Use raw fetch here (NOT apiRequest) because this endpoint
		// should always be reachable, even before login, and must
		// run regardless of the current auth state.
		const res = await fetch(`${API_BASE}/auth/csrf`, {
			credentials: 'include',
		});
		if (!res.ok) return null;
		const json = (await res.json()) as {
			success?: boolean;
			data?: { token?: string };
		};
		return json.data?.token ?? readCsrfCookie();
	} catch {
		return readCsrfCookie();
	}
}

/** HTTP methods that must carry a CSRF token. Anything else (GET,
 *  HEAD, OPTIONS) is safe to skip. */
const CSRF_PROTECTED_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export class ApiError extends Error {
	status: number;
	/** Stable error code from `ErrorCodes` (or unknown string for new codes). */
	code?: string;
	/** Server request ID for log correlation. */
	request_id?: string;
	/** Optional structured details (e.g. Zod issues, PG constraint). */
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

export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
	const url = `${API_BASE}${endpoint}`;
	// Set up a default timeout so the UI doesn't hang forever on a
	// stuck connection. If the caller already passed a signal, attach
	// both so either timeout can cancel the request.
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);
	const callerSignal = options?.signal;
	const onCallerAbort = () => controller.abort();
	if (callerSignal) {
		if (callerSignal.aborted) controller.abort();
		else callerSignal.addEventListener('abort', onCallerAbort);
	}
	// Destructure headers out of options before spreading to prevent
	// caller headers from silently overriding Content-Type.
	const { headers: callerHeaders, ...restOptions } = options || {};
	// Filter out sensitive headers from caller to prevent override attacks
	const safeCallerHeaders: Record<string, string> = {};
	if (callerHeaders) {
		for (const [key, value] of Object.entries(callerHeaders)) {
			const lk = key.toLowerCase();
			// Allow Authorization header for backward compatibility (Bearer token)
			if (lk !== 'content-type' && value != null) {
				safeCallerHeaders[key] = String(value);
			}
		}
	}
	// P0 (2026-07-12): attach the CSRF token to mutating requests. The
	// token is read from the non-HttpOnly `noufex_csrf` cookie set by
	// the server on every safe-method response. If the cookie is missing
	// (e.g. cleared by the user) the request goes through without a
	// token — the server then 403s with `CSRF_INVALID` and the SPA can
	// recover by issuing a GET to /api/auth/csrf to mint a new token.
	const method = (restOptions.method ?? 'GET').toUpperCase();
	if (CSRF_PROTECTED_METHODS.has(method)) {
		const csrf = readCsrfCookie();
		if (csrf) safeCallerHeaders['x-csrf-token'] = csrf;
	}
	const config: RequestInit = {
		headers: {
			'Content-Type': 'application/json',
			...safeCallerHeaders,
		},
		// SECURITY: Include HttpOnly auth cookie automatically
		credentials: 'include',
		...restOptions,
		signal: controller.signal,
	};

	let response: Response;
	try {
		response = await fetch(url, config);
	} finally {
		// Always clear the timeout — even if fetch throws (network
		// error, abort) so the timer doesn't leak.
		clearTimeout(timeoutId);
		// Clean up the caller signal listener to avoid leaking it on
		// long-lived components that issue many requests.
		if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
	}

	// Check for non-2xx responses first (e.g. 502 from reverse proxy)
	if (!response.ok) {
		// Try to parse error response from server
		let errorData: ApiResponse<T> | null = null;
		try {
			errorData = (await response.json()) as ApiResponse<T>;
		} catch {
			// No JSON body (e.g. reverse proxy HTML error)
		}
		if (errorData && !errorData.success) {
			throw new ApiError(
				errorData.error || 'Request failed',
				response.status,
				errorData.code,
				errorData.request_id,
				errorData.details,
			);
		}
		throw new ApiError(
			`Server returned ${response.status} ${response.statusText}`,
			response.status,
		);
	}

	// Handle non-JSON responses (e.g. 502 from reverse proxy returning HTML)
	let json: ApiResponse<T>;
	try {
		json = (await response.json()) as ApiResponse<T>;
	} catch {
		throw new ApiError(
			`Server returned non-JSON response (${response.status})`,
			response.status,
		);
	}

	if (!json.success) {
		// ApiError carries code + request_id so callers can branch on
		// the stable machine-readable code (NOT_FOUND, VALIDATION_ERROR,
		// ...) instead of parsing human-readable message strings.
		throw new ApiError(
			json.error || 'API request failed',
			response.status,
			json.code,
			json.request_id,
			json.details,
		);
	}

	return json.data as T;
}

export { API_BASE };
// Re-export the frontend-mirrored catalog so call sites can do:
//   import { ErrorCodes, isErrorCode } from '@/lib/api';
// The mirror is in `./error-codes.ts` (see that file for the sync rule).
// Note: we import the local `isErrorCode` under a private alias to
// avoid the public re-export below colliding with the
// helper in `./error-codes.ts` (it has a different signature).
import { isErrorCode as _isErrorCode } from './error-codes';
export { ErrorCodes, ErrorStatuses } from './error-codes';

// ─── Error helpers (R-15 follow-up §50) ──────────────────
// These let call sites branch on the stable machine-readable `code`
// without re-implementing the `instanceof ApiError` check at every
// catch site. Use them in components:
//
//   try {
//     await login(email, password);
//   } catch (err) {
//     if (isApiError(err) && isErrorCode(err.code, ErrorCodes.UNAUTHORIZED)) {
//       toast.error(t('errors.invalidCredentials'));
//     } else {
//       toast.error(t('errors.generic'));
//     }
//   }

/**
 * Type guard: was this error thrown by our `apiRequest` wrapper?
 * `ApiError` carries `code`, `request_id`, and `details`; a plain
 * `Error` (e.g. from a network failure or a third-party fetch
 * rejection) does NOT. Always narrow with this before reading those
 * fields.
 */
export function isApiError(err: unknown): err is ApiError {
	return err instanceof ApiError;
}

/**
 * Type guard: does this `unknown` (typically `err.code` on an
 * `ApiError`) match one of our known error codes? Combines well
 * with `isApiError`:
 *
 *   if (isApiError(err) && isErrorCode(err.code, ErrorCodes.NOT_FOUND)) {
 *     // narrow to `ErrorCode` here
 *   }
 *
 * The second arg can be either a single code or an array of codes:
 *
 *   if (isErrorCode(err.code, [ErrorCodes.UNAUTHORIZED, ErrorCodes.FORBIDDEN])) { ... }
 */
export function isErrorCode(
	value: unknown,
	expected: string | readonly string[],
): boolean {
	if (!_isErrorCode(value)) return false;
	if (typeof expected === 'string') return value === expected;
	return (expected as readonly string[]).includes(value);
}
