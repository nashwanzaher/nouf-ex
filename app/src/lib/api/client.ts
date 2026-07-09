/**
 * Nouf-ex Frontend API Client — base fetch wrapper
 *
 * Internal module: provides the typed fetch wrapper and error class used
 * by every domain-specific file (products.ts, orders.ts, etc.). Do NOT
 * import from this file directly — import from `./index.ts` (the public
 * surface) or from the domain file you need.
 */

const API_BASE: string =
	(import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL ?? '/api';

export interface ApiResponse<T> {
	success: boolean;
	data: T;
	message?: string;
	error?: string;
	/** Stable machine-readable code (e.g. `'NOT_FOUND'`, `'VALIDATION_ERROR'`).
	 *  Defined by `app/server/lib/error-codes.ts` `ErrorCodes`. Use
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

function readAuthToken(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage.getItem('noufex_token');
	} catch {
		return null;
	}
}

export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
	const url = `${API_BASE}${endpoint}`;
	const token = readAuthToken();
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
	// caller headers from silently overriding Content-Type and Authorization.
	const { headers: callerHeaders, ...restOptions } = options || {};
	const config: RequestInit = {
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...callerHeaders,
		},
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
