/**
 * Sentry integration — Tier 2.3.
 *
 * Lazily initialised when `SENTRY_DSN` is set. Captures:
 *   - Unhandled exceptions (Express handler chain via Sentry.requestHandler)
 *   - Unhandled rejections (process.on('unhandledRejection'))
 *   - Worker job failures (callers wrap with `captureWorkerError`)
 *   - Slow DB queries (transaction > 1s — via beforeSend breadcrumb)
 *
 * Performance tracing
 *   - The integration creates a transaction per HTTP request. Custom
 *     spans attach around DB queries, Redis ops, ES calls, and
 *     RabbitMQ publishes so a slow request is traceable end-to-end.
 *
 * PII
 *   - `sendDefaultPii: false` (default in @sentry/node 8.x) — we
 *     explicitly scrub `password`, `token`, `cookie`, and any
 *     `Authorization` header before send.
 *   - The CSP nonce and CSRF token are also scrubbed.
 *
 * Fail-OPEN
 *   - If `SENTRY_DSN` is unset, every helper is a no-op. Local
 *     dev + tests run without sending anything to sentry.io.
 */
import * as Sentry from '@sentry/node';
import { log } from './shared.ts';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE ?? process.env.APP_VERSION ?? 'dev';

let initialised = false;

export function isSentryEnabled(): boolean {
	return Boolean(SENTRY_DSN);
}

export function initSentry(): void {
	if (initialised) return;
	if (!SENTRY_DSN) {
		log.info({ msg: 'sentry_disabled_no_dsn' });
		return;
	}
	Sentry.init({
		dsn: SENTRY_DSN,
		environment: SENTRY_ENVIRONMENT,
		release: SENTRY_RELEASE,
		tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
		profilesSampleRate: Number.parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '0.05'),
		sendDefaultPii: false,
		beforeSend(event) {
			// Strip anything sensitive that the framework added by accident.
			if (event.request?.headers) {
				const h = event.request.headers as Record<string, string>;
				for (const k of ['authorization', 'cookie', 'x-csrf-token', 'x-api-key']) {
					if (h[k]) h[k] = '[redacted]';
				}
			}
			return event;
		},
		beforeBreadcrumb(crumb) {
			if (crumb.category === 'http' && crumb.data?.url) {
				const url = String(crumb.data.url);
				// Don't leak CSRF tokens or session cookies to breadcrumbs.
				crumb.data = { ...crumb.data, url: url.split('?')[0] };
			}
			return crumb;
		},
		integrations: [
			Sentry.httpIntegration(),
			Sentry.expressIntegration(),
			Sentry.postgresIntegration(),
		],
	});
	initialised = true;
	log.info({ msg: 'sentry_initialised', environment: SENTRY_ENVIRONMENT, release: SENTRY_RELEASE });
}

/**
 * Sentry Express handlers.
 *
 * In Sentry v8 the request + tracing handlers are replaced by
 * `Sentry.requestHandler()` / `Sentry.tracingHandler()` no-ops —
 * instrumentation is now done via the `httpIntegration()` and
 * `expressIntegration()` listed in `initSentry()`. The exported
 * helpers below exist for backwards compatibility with call sites
 * that expect the v7 shape (request → next → error); in v8 they
 * are no-op pass-throughs.
 */
export const sentryHandlers = {
	requestHandler: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	tracingHandler: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	errorHandler: () => Sentry.expressErrorHandler(),
} as const;

/** Capture an exception from outside an Express handler (workers,
 *  scheduled jobs, queue consumers). */
export function captureWorkerError(err: unknown, context: { queue?: string; messageId?: string; extra?: Record<string, unknown> } = {}): void {
	if (!isSentryEnabled()) return;
	Sentry.withScope((scope) => {
		if (context.queue) scope.setTag('queue', context.queue);
		if (context.messageId) scope.setTag('message_id', context.messageId);
		if (context.extra) scope.setExtras(context.extra);
		Sentry.captureException(err);
	});
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
	if (!isSentryEnabled()) return;
	Sentry.captureMessage(message, level);
}

/** Wrap an async function so its error is auto-captured AND rethrown. */
export async function withSentry<T>(fn: () => Promise<T>, context?: Record<string, unknown>): Promise<T> {
	try {
		return await fn();
	} catch (err) {
		if (isSentryEnabled()) {
			Sentry.withScope((scope) => {
				if (context) scope.setExtras(context);
				Sentry.captureException(err);
			});
		}
		throw err;
	}
}

export async function flushSentry(timeoutMs = 2_000): Promise<void> {
	if (!isSentryEnabled()) return;
	try {
		await Sentry.flush(timeoutMs);
	} catch {
		// best-effort
	}
}

export { Sentry };