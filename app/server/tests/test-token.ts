/**
 * Test helper — sign a real Bearer token for supertest requests.
 *
 * The router files use `requireAuth` which validates the
 * `Authorization: Bearer <token>` header. The token is verified
 * with the `AUTH_SECRET` env var. This helper signs a fresh token
 * with the same secret so we can drive the authenticated paths
 * of the route handlers end-to-end (not just test the 401 gate).
 *
 * Usage:
 *
 *   import { signTestToken } from './__helpers__/test-token.js';
 *   const token = signTestToken({ sub: 7, role: 'customer' });
 *   await request(app)
 *     .get('/api/cart/7')
 *     .set('Authorization', `Bearer ${token}`);
 */
import { signAuthToken, type AuthRole } from '../middleware.js';

export function signTestToken(payload: { sub: number; role: AuthRole }): string {
	return signAuthToken(payload);
}
