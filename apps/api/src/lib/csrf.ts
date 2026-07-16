/**
 * CSRF (Cross-Site Request Forgery) protection — P0 security (2026-07-12).
 *
 * Pattern: "double-submit cookie" (a.k.a. "Synchronizer Token Pattern lite").
 *
 *   1. Client first calls `GET /api/auth/csrf`. The server generates a
 *      cryptographically-random token, sets it in TWO cookies:
 *
 *        - `noufex_csrf`  — readable by JS (NOT HttpOnly). The SPA
 *                            reads this and echoes it back in the
 *                            `x-csrf-token` request header on every
 *                            mutating request.
 *        - `noufex_csrf_h` — HttpOnly. The server compares against
 *                            this on every mutating request. SameSite=Strict
 *                            blocks third-party sites from setting or
 *                            reading this cookie.
 *
 *   2. On every mutating request (POST/PATCH/DELETE), the middleware
 *      compares the value of `noufex_csrf` and `noufex_csrf_h` cookies
 *      AND against the `x-csrf-token` header using
 *      `crypto.timingSafeEqual()`. Mismatch → 403 CSRF_INVALID.
 *
 * Why double-submit (not server-session token)?
 *   - Stateless: no in-memory map to populate on every request.
 *   - Works with our cookie-based auth (HttpOnly `noufex_token`).
 *   - First-party only — `SameSite=Strict` blocks cross-origin.
 *
 * Why a separate header (not just a body field)?
 *   - Pre-flight CORS preflight will reject non-simple headers in
 *     some browsers without `allowedHeaders` — but our CORS config
 *     allows `Content-Type, x-csrf-token` for our trusted origin.
 *
 * Exemptions:
 *   - GET / HEAD / OPTIONS — never mutate state.
 *   - `/api/auth/forgot-password` and `/api/auth/reset-password` —
 *     email-driven flows; the reset token itself acts as the nonce.
 *   - `/api/auth/refresh` — called by the SPA's automatic token refresh
 *     interceptor; protected by the HttpOnly auth cookie + SameSite=Strict.
 *   - `/api/auth/csrf` — the endpoint that mints the token.
 *   - `/api/health` and `/api/ready` — public health probes.
 *
 * SECURITY NOTE (2026-07-15): `/api/auth/login` and `/api/auth/register`
 * are NO LONGER exempt. Login CSRF is real: an attacker can trick a victim
 * into logging into the attacker's account, causing the victim's subsequent
 * actions (orders, addresses, reviews) to be linked to the attacker.
 * The SPA mints a CSRF token via `ensureCsrfToken()` on boot and on every
 * safe request, so the token is available before login.
 */
import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { sendError } from './shared.ts';

const CSRF_COOKIE = 'noufex_csrf';
const CSRF_HEADER = 'x-csrf-token';
/** Routes that are exempt from CSRF — primarily unauthenticated
 *  endpoints (login, register, health probes). Everything else
 *  — including every authenticated mutation — requires the token. */
const CSRF_EXEMPT_PREFIXES = [
	// Unauthenticated login/registration are NOT exempt — the SPA mints
	// a CSRF token on boot and on every safe request before calling them.
	'/api/auth/forgot-password',
	'/api/auth/reset-password',
	'/api/auth/refresh',
	'/api/auth/csrf',
	'/api/health',
	'/api/ready',
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	try {
		return timingSafeEqual(Buffer.from(a), Buffer.from(b));
	} catch {
		return false;
	}
}

function generateToken(): string {
	return randomBytes(32).toString('base64url');
}

/** Attach a freshly-minted CSRF token to the response. Safe to call
 *  on every request — only sets cookies if they're missing.
 *
 *  Uses `res.locals.csrfToken` to ensure multiple calls within the
 *  same request lifecycle (e.g. middleware + `/api/auth/csrf` endpoint)
 *  reuse the SAME token. Without this, the endpoint would mint a second
 *  token because `req.cookies` is not updated after the middleware sets
 *  the cookie on the response, causing a mismatch.
 */
export function ensureCsrfCookie(req: Request, res: Response): string {
	// Reuse token already minted earlier in this request lifecycle.
	if (res.locals.csrfToken) {
		return res.locals.csrfToken as string;
	}

	const existing = req.cookies?.[CSRF_COOKIE];
	if (existing && /^[A-Za-z0-9_-]{20,}$/.test(existing)) {
		// Make sure the HttpOnly mirror is also set, in case it was
		// dropped by a previous request (e.g. after the user cleared
		// the non-HttpOnly cookie but not the HttpOnly one).
		if (!req.cookies?.['noufex_csrf_h']) {
			res.cookie('noufex_csrf_h', existing, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'strict',
				path: '/',
				maxAge: 24 * 60 * 60 * 1000,
			});
		}
		res.locals.csrfToken = existing;
		return existing;
	}
	const token = generateToken();
	res.cookie(CSRF_COOKIE, token, {
		httpOnly: false, // MUST be readable by the SPA
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		path: '/',
		maxAge: 24 * 60 * 60 * 1000,
	});
	res.cookie('noufex_csrf_h', token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		path: '/',
		maxAge: 24 * 60 * 60 * 1000,
	});
	res.locals.csrfToken = token;
	return token;
}

/** Express middleware factory. Apply once globally in `index.ts`. */
export function csrfProtection() {
	return (req: Request, res: Response, next: NextFunction): void => {
		// Safe methods don't need a token. On GET we ALSO refresh the
		// cookie so the SPA can read it for the next mutation.
		if (SAFE_METHODS.has(req.method)) {
			ensureCsrfCookie(req, res);
			next();
			return;
		}
		// Exempt auth routes (pre-session).
		if (CSRF_EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) {
			next();
			return;
		}
		const cookieToken = req.cookies?.[CSRF_COOKIE] ?? '';
		const headerToken = String(req.headers[CSRF_HEADER] ?? '');
		const httpOnlyMirror = req.cookies?.['noufex_csrf_h'] ?? '';
		if (
			!cookieToken ||
			!httpOnlyMirror ||
			!headerToken ||
			!safeEqual(cookieToken, httpOnlyMirror) ||
			!safeEqual(cookieToken, headerToken)
		) {
			sendError(
				res,
				'CSRF token missing or invalid. Reload the page and retry.',
				403,
				'CSRF_INVALID',
			);
			return;
		}
		next();
	};
}

/** Standalone GET endpoint — returns the freshly minted token in
 *  JSON AND in cookies so the SPA can read either. */
export function csrfTokenEndpoint(_req: Request, res: Response): void {
	const token = ensureCsrfCookie(_req, res);
	res.json({ success: true, data: { token } });
}
