/**
 * Test helper — sign a real Bearer token for supertest requests.
 *
 * The router files use `requireAuth` which validates the
 * `Authorization: Bearer <token>` header. The token is verified
 * with the `AUTH_SECRET` env var. This helper signs a fresh token
 * with the same secret so we can drive the authenticated paths
 * of the route handlers end-to-end (not just test the 401 gate).
 *
 * SECURITY (C-3): tests must stamp a `ver` that matches the
 * `users.token_version` of the seeded user, AND seed the per-
 * process `tokenVersionCache` so the lookup in `requireAuth`
 * short-circuits and the mocked pg driver doesn't return an empty
 * row. The default `ver = 0` matches the seeded users from
 * migration 0017.
 *
 * Usage:
 *
 *   import { signTestToken } from './__helpers__/test-token.js';
 *   const token = signTestToken({ sub: 7, role: 'customer' });
 *   await request(app)
 *     .get('/api/cart/7')
 *     .set('Authorization', `Bearer ${token}`);
 */
import {
	signAuthToken,
	__setCachedAuthForTests,
	type AuthRole,
} from '../middleware.js';

export function signTestToken(payload: { sub: number; role: AuthRole; ver?: number }): string {
	const ver = payload.ver ?? 0;
	// Seed the per-process cache so `requireAuth`'s DB lookup returns
	// `ver` instead of `null` (which would 401). The cache lives in
	// the middleware module so all route handlers see it.
	__setCachedAuthForTests(payload.sub, ver, payload.role);
	return signAuthToken({ ver, ...payload });
}
