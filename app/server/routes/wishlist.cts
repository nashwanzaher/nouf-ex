import { Router, type Request, type Response } from 'express';
import {
	db,
	sendSuccess,
	sendError,
	validate,
	requireAuth,
	wishlistAddSchema,
	wishlistItemIdParamSchema,
} from '../lib/shared.cts';

export const wishlistRouter = Router();

wishlistRouter.get('/:userId', requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = req.user!.id;
		const items = await db
			.prepare(
				`SELECT w.*, p.name_en, p.name_ar, p.name_zh, p.price, p.original_price, p.main_image, p.rating, p.review_count, s.store_name
         FROM wishlist w
         JOIN products p ON w.product_id = p.id
         LEFT JOIN stores s ON p.store_id = s.id
         WHERE w.user_id = ?
         ORDER BY w.created_at DESC`,
			)
			.all(userId);
		return sendSuccess(res, items);
	} catch (err) {
		return sendError(res, err);
	}
});

wishlistRouter.post('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(wishlistAddSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, 'VALIDATION_ERROR');
		const { productId } = v.data;
		const userId = req.user!.id;

		const existing = (await db
			.prepare('SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?')
			.get(userId, productId)) as Record<string, unknown> | undefined;

		if (existing) {
			return sendSuccess(res, null, 'Already in wishlist');
		}

		const result = (await db
			.prepare(
				'INSERT INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) RETURNING id',
			)
			.run(userId, productId)) as { lastInsertRowid: number | null };
		if (result.lastInsertRowid == null) {
			return sendError(res, 'Failed to add to wishlist', 500, 'INSERT_FAILED');
		}

		return sendSuccess(res, { id: result.lastInsertRowid }, 'Added to wishlist');
	} catch (err) {
		return sendError(res, err);
	}
});

wishlistRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(wishlistItemIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid wishlist item id: ' + v.error, 400);
		const wishlistItemId = v.data.id;
		const userId = req.user!.id;
		const result = (await db
			.prepare('DELETE FROM wishlist WHERE id = ? AND user_id = ? RETURNING id')
			.get(wishlistItemId, userId)) as { id: number } | undefined;
		if (!result) return sendError(res, 'Wishlist item not found', 404);
		return sendSuccess(res, { id: result.id }, 'Removed from wishlist');
	} catch (err) {
		return sendError(res, err);
	}
});
