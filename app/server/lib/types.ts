/**
 * Shared types used by both `middleware.ts` (auth cache) and `shared.cts`
 * (route handlers that consume the auth result). Extracted on 2026-07-03
 * to break the circular import between those two modules.
 *
 * The previous dependency graph was:
 *   middleware.ts  ──▶  shared.cts  (imports sendError, requireAuth, …)
 *   shared.cts     ──▶  middleware.js (imports HttpError, log, …)
 *
 * After this refactor, both modules import from `./types.js` (no further
 * dependencies), so the import graph is acyclic:
 *   middleware.ts  ──▶  types.js
 *   shared.cts     ──▶  types.js  (re-exports)
 *   shared.cts     ──▶  middleware.js (for behaviour, not types)
 */

/** The set of role strings that the auth subsystem recognises.
 *  Used by `requireRole(...allowed)` to gate route access. */
export type AuthRole = 'customer' | 'merchant' | 'admin';

/** Decoded payload of a signed HMAC-SHA256 Bearer token.
 *
 *  Populated by `verifyAuthToken()` from the `body` segment of a token
 *  `<base64url(payload)>.<base64url(sig)>` string. The `ver` field is
 *  matched against `users.token_version` on every authenticated request
 *  (cached in `middleware.authCache` for 30 s) to support instant
 *  revocation via `/api/auth/logout` or `/api/auth/change-password`. */
export interface TokenPayload {
	sub: number;
	role: AuthRole;
	exp: number; // unix seconds
	/** Per-user token version. Bumped server-side to invalidate
	 *  all outstanding tokens for that user. */
	ver: number;
}