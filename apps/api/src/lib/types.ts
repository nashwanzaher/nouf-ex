/**
 * Shared types used by both `middleware.ts` (auth cache) and `shared.ts`
 * (route handlers that consume the auth result). Extracted on 2026-07-03
 * to break the circular import between those two modules.
 *
 * The previous dependency graph was:
 *   middleware.ts  ──▶  shared.ts  (imports sendError, requireAuth, …)
 *   shared.ts     ──▶  middleware.ts (imports HttpError, log, …)
 *
 * After this refactor, both modules import from `./types.js` (no further
 * dependencies), so the import graph is acyclic:
 *   middleware.ts  ──▶  types.js
 *   shared.ts     ──▶  types.js  (re-exports)
 *   shared.ts     ──▶  middleware.js (for behaviour, not types)
 */

/** The set of role strings that the auth subsystem recognises.
 *  Used by `requireRole(...allowed)` to gate route access.
 *
 *  SECURITY (DB-CRITICAL): must match the CHECK constraint on
 *  users.role in schema.sql + migrations/0036_extend_role_enum.sql:
 *  ('super_admin','store_reviewer','catalog_moderator',
 *   'support_agent','finance_admin','merchant','customer','delivery_agent').
 *  Adding a new role requires updating BOTH this type AND the SQL
 *  constraint in the same migration. The bootstrap CLI
 *  (`npm run bootstrap:admin`) creates the FIRST user with
 *  `super_admin`; no other role can self-register.
 *
 *  Role hierarchy (most → least privileged):
 *    super_admin        — platform owner, full control
 *    store_reviewer     — KYC, approves / rejects merchants
 *    catalog_moderator  — approves / rejects products
 *    finance_admin      — refunds, commissions, payouts
 *    support_agent      — L1 customer support, read-only on PII
 *    merchant           — owns and operates one or more stores
 *    customer           — buys from merchants
 *    delivery_agent     — fulfills orders assigned to them
 */
export type AuthRole =
	| 'super_admin'
	| 'store_reviewer'
	| 'catalog_moderator'
	| 'finance_admin'
	| 'support_agent'
	| 'merchant'
	| 'customer'
	| 'delivery_agent';

/** Role groups — used by `requireRole(...allowed)` to gate routes.
 *  The leading group is the most-privileged superset; the
 *  middleware uses array `.includes()` so passing multiple roles
 *  means "any of these". */
export const ADMIN_OPERATOR_ROLES = [
	'super_admin',
	'store_reviewer',
	'catalog_moderator',
	'finance_admin',
	'support_agent',
] as const;
export const ADMIN_ROLES = ['super_admin', ...ADMIN_OPERATOR_ROLES.slice(1)] as const;

/**
 * `isAdminOperator(role)` — true for ANY operator role
 * (super_admin + the four functional admin roles). Drop-in
 * replacement for `role === 'admin'` after the R-SUPER-3
 * migration. Routes that previously required `'admin'` now
 * accept any operator; routes that should be super-admin-only
 * must use `requireRole('super_admin')` explicitly.
 */
export function isAdminOperator(role: AuthRole | undefined | null): boolean {
	if (!role) return false;
	return (ADMIN_OPERATOR_ROLES as readonly AuthRole[]).includes(role);
}

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