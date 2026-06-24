import { Router, type Request, type Response } from 'express';
import {
	db,
	sendSuccess,
	sendError,
	validate,
	requireAuth,
	cartAddSchema,
	cartItemIdParamSchema,
} from '../lib/shared.cts';

export const cartRouter = Router();

cartRouter.get('/:userId', requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = req.user!.id;
		const cartItems = await db
			.prepare(
				`SELECT ci.*, p.name_en, p.name_ar, p.name_zh, p.price, p.original_price, p.main_image, p.stock, s.store_name
         FROM cart_items ci
         JOIN products p ON ci.product_id = p.id
         LEFT JOIN stores s ON p.store_id = s.id
         WHERE ci.user_id = ?
         ORDER BY ci.created_at DESC`,
			)
			.all(userId);
		sendSuccess(res, cartItems);
	} catch (err) {
		return sendError(res, err);
	}
});

cartRouter.post('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(cartAddSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, 'VALIDATION_ERROR');
		const { productId, quantity, variant } = v.data;
		const userId = req.user!.id;

		const existing = (await db
			.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?')
			.get(userId, productId)) as { id: number; quantity: number } | undefined;

		if (existing) {
			await db
				.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?')
				.run(quantity, existing.id);
			return sendSuccess(res, { id: existing.id }, 'Cart updated successfully');
		}
		const result = (await db
			.prepare(
				`INSERT INTO cart_items (user_id, product_id, quantity, variant, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         RETURNING id`,
			)
			.run(userId, productId, quantity, variant ? JSON.stringify(variant) : null)) as {
			lastInsertRowid: number | null;
		};
		if (result.lastInsertRowid == null) {
			return sendError(res, 'Failed to add item to cart', 500, 'INSERT_FAILED');
		}
		return sendSuccess(res, { id: result.lastInsertRowid }, 'Item added to cart');
	} catch (err) {
		return sendError(res, err);
	}
});

cartRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(cartItemIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid cart item id: ' + v.error, 400);
		const cartItemId = v.data.id;
		const userId = req.user!.id;
		const result = (await db
			.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ? RETURNING id')
			.get(cartItemId, userId)) as { id: number } | undefined;
		if (!result) return sendError(res, 'Cart item not found', 404);
		return sendSuccess(res, { id: result.id }, 'Item removed from cart');
	} catch (err) {
		return sendError(res, err);
	}
});

cartRouter.delete('/clear/:userId', requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = req.user!.id;
		const result = await db
			.prepare('DELETE FROM cart_items WHERE user_id = ? RETURNING id')
			.run(userId);
		const removed = Number((result as unknown as { changes: number }).changes ?? 0);
		return sendSuccess(res, { removed }, 'Cart cleared');
	} catch (err) {
		return sendError(res, err);
	}
});

cartRouter.get('/count/:userId', requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = Number(req.params.userId);
		if (!Number.isInteger(userId) || userId <= 0) {
			return sendError(res, 'Invalid user id', 400);
		}
		if (req.user!.id !== userId && req.user!.role !== 'admin') {
			return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
		}
		const row = (await db
			.prepare(
				'SELECT COALESCE(SUM(quantity), 0)::int AS c FROM cart_items WHERE user_id = $1',
			)
			.get(userId)) as { c: number } | undefined;
		// `get()` returns undefined when no row matches; the COALESCE
		// in the SQL means an empty cart should still produce 0, but
		// the mock + a fresh database both yield undefined. Default to 0.
		return sendSuccess(res, { user_id: userId, count: row?.c ?? 0 });
	} catch (err) {
		return sendError(res, err);
	}
});
