/**
 * Store followers — follow / unfollow / check.
 *
 * Tells the storefront whether the user already follows a given store so
 * the Follow button can render its current state, and lets authenticated
 * customers follow or unfollow a store. Follower counts are kept in sync
 * with the stores table by triggers.
 *
 * Mounted at /api/ by index.ts as /store-followers.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db, sendSuccess, sendError, validate, requireAuth } from '../lib/shared.ts';

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
				 WHERE store_id = $1 AND user_id = $2`,
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

const followStoreSchema = z.object({
	store_id: z.coerce.number().int().positive(),
	notify_new_products: z.boolean().optional().default(true),
	notify_offers: z.boolean().optional().default(true),
});

/** POST /api/store-followers
 *  Follow a store. Idempotent: if the user already follows the store,
 *  the existing preferences are updated and the request succeeds.
 */
storeFollowersRouter.post('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(followStoreSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const userId = req.user!.id;
		const { store_id, notify_new_products, notify_offers } = v.data;

		const existing = (await db
			.prepare('SELECT id FROM store_followers WHERE store_id = $1 AND user_id = $2')
			.get(store_id, userId)) as { id: number } | undefined;

		if (existing) {
			await db
				.prepare(
					`UPDATE store_followers
					    SET notify_new_products = $1,
					        notify_offers = $2
					  WHERE id = $3`,
				)
				.run(notify_new_products, notify_offers, existing.id);
			return sendSuccess(
				res,
				{ id: existing.id, store_id, following: true },
				'Follow updated',
			);
		}

		const result = (await db
			.prepare(
				`INSERT INTO store_followers (store_id, user_id, notify_new_products, notify_offers, created_at)
				 VALUES ($1, $2, $3, $4, NOW())
				 RETURNING id`,
			)
			.get(store_id, userId, notify_new_products, notify_offers)) as { id: number };
		return sendSuccess(res, { id: result.id, store_id, following: true }, 'Store followed');
	} catch (err) {
		return sendError(res, err);
	}
});

const unfollowStoreSchema = z.object({
	store_id: z.number().int().positive(),
});

/** DELETE /api/store-followers
 *  Unfollow a store. Idempotent: succeeds even if the follow record
 *  did not exist.
 */
storeFollowersRouter.delete('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(unfollowStoreSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const userId = req.user!.id;
		const { store_id } = v.data;

		const result = (await db
			.prepare(
				'DELETE FROM store_followers WHERE store_id = $1 AND user_id = $2 RETURNING id',
			)
			.get(store_id, userId)) as { id: number } | undefined;

		return sendSuccess(
			res,
			{ store_id, following: false, removed: result !== undefined },
			'Store unfollowed',
		);
	} catch (err) {
		return sendError(res, err);
	}
});
