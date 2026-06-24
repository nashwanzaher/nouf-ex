/**
 * Store followers — single endpoint.
 *
 * Tells the storefront whether the user already follows a given store so
 * the Follow button can render its current state. The check is auth-gated
 * and authorized against the row's user_id (admins can check anyone).
 *
 * Mounted at /api/ by index.ts as /store-followers/check.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db, sendSuccess, sendError, validate, requireAuth } from '../lib/shared.cts';

export const storeFollowersRouter = Router();

const checkFollowSchema = z.object({
	store_id: z.coerce.number().int().positive(),
	user_id: z.coerce.number().int().positive(),
});

storeFollowersRouter.get('/check', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(checkFollowSchema, req.query);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);
		// Users can only check their own follow state; admins can check
		// anyone's. This prevents leaking the existence of user accounts
		// by enumerating follow records.
		if (req.user!.id !== v.data.user_id && req.user!.role !== 'admin') {
			return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
		}
		const row = (await db
			.prepare(
				`SELECT id, notify_new_products, notify_offers, created_at
				 FROM store_followers
				 WHERE store_id = $1 AND user_id = $2`
			)
			.get(v.data.store_id, v.data.user_id)) as
			| {
					id: number;
					notify_new_products: boolean;
					notify_offers: boolean;
					created_at: string;
			  }
			| undefined;
		return sendSuccess(res, {
			store_id: v.data.store_id,
			user_id: v.data.user_id,
			following: row !== undefined,
			preferences: row
				? {
						notify_new_products: row.notify_new_products,
						notify_offers: row.notify_offers,
						since: row.created_at,
					}
				: null,
		});
	} catch (err) {
		return sendError(res, err);
	}
});
