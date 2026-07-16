/**
 * Retry-with-backoff wrapper — Tier 2.5.
 *
 * Wraps an async function so transient Elasticsearch failures
 * (network reset, 503, 504, ES connection refused during a rolling
 * restart) get retried with exponential backoff + jitter, instead
 * of immediately landing in the DLQ.
 *
 * Failure modes
 *   - Retryable:   ESConnectionError, timeouts, 5xx responses
 *   - Permanent:   mapping conflict (400), 404 on a delete,
 *                  document validation errors
 *
 * Defaults
 *   - 5 attempts
 *   - backoff = min(1000 * 2^attempt, 30_000) ms
 *   - jitter   = ± 30 % (multiplicative)
 *
 * The wrapper is also called from the search-indexer worker, so
 * a brief ES outage during a deploy only NACKs the most recent
 * message rather than the entire queue.
 */
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_MS = 1_000;
const DEFAULT_CAP_MS = 30_000;
const JITTER_RATIO = 0.3;

export interface RetryOptions {
	maxAttempts?: number;
	baseMs?: number;
	capMs?: number;
	onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
	isRetryable?: (err: unknown) => boolean;
}

function defaultIsRetryable(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	const name = err.name ?? '';
	const message = err.message ?? '';
	// Network-level errors
	if (
		name === 'ConnectionError' ||
		name === 'TimeoutError' ||
		name === 'NoLivingConnectionsError'
	) {
		return true;
	}
	// HTTP 5xx from the cluster
	const m = message.match(/^\[(\d{3})\]/);
	if (m) {
		const status = Number.parseInt(m[1], 10);
		if (status >= 500 && status < 600) return true;
		if (status === 429) return true; // rate-limited
	}
	// Generic TCP-level resets
	if (/ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND/i.test(message)) return true;
	return false;
}

function computeDelay(attempt: number, baseMs: number, capMs: number): number {
	const exp = Math.min(baseMs * 2 ** (attempt - 1), capMs);
	const jitter = exp * JITTER_RATIO * (Math.random() * 2 - 1);
	return Math.max(0, Math.round(exp + jitter));
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
	const baseMs = options.baseMs ?? DEFAULT_BASE_MS;
	const capMs = options.capMs ?? DEFAULT_CAP_MS;
	const isRetryable = options.isRetryable ?? defaultIsRetryable;
	let lastErr: unknown;
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			if (attempt === maxAttempts) break;
			if (!isRetryable(err)) break;
			const delay = computeDelay(attempt, baseMs, capMs);
			if (options.onRetry) options.onRetry(err, attempt, delay);
			await sleep(delay);
		}
	}
	throw lastErr;
}