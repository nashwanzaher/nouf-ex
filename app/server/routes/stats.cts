/**
 * Home stats — public, no auth.
 *
 * Returns a compact dashboard summary for the storefront landing page:
 *   - Counts of active products, active stores, all orders, and all users.
 *   - Up to 6 featured products (is_featured = 1, ordered by created_at).
 *   - Up to 6 deals (deal_discount > 0, ordered by deal_discount).
 *
 * Mounted at /api/ by index.ts. The path is /stats/home (not /stats) so
 * future admin dashboard stats can live under /api/admin/stats without
 * colliding.
 */
import { Router, type Request, type Response } from 'express';
import { db, sendSuccess, sendError, getProductWithParsedFields } from '../lib/shared.cts';

export const statsRouter = Router();

statsRouter.get('/home', async (_req: Request, res: Response) => {
	try {
		// `get()` returns `undefined` when no row matches. Guard each
		// count so a fresh / empty database (or a test mock that returns
		// no rows) does not throw a TypeError. The default of 0 keeps
		// the home page rendering zeros instead of 500.
		const pick = (row: unknown): number => (row as { count?: number } | undefined)?.count ?? 0;
		const productsCount = pick(
			await db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get(),
		);
		const storesCount = pick(
			await db.prepare('SELECT COUNT(*) as count FROM stores WHERE is_active = 1').get(),
		);
		const ordersCount = pick(await db.prepare('SELECT COUNT(*) as count FROM orders').get());
		const usersCount = pick(await db.prepare('SELECT COUNT(*) as count FROM users').get());

		const featuredProducts = (await db
			.prepare(
				'SELECT * FROM products WHERE is_active = 1 AND is_featured = 1 ORDER BY created_at DESC LIMIT 6',
			)
			.all()) as Record<string, unknown>[];

		const dealsProducts = (await db
			.prepare(
				'SELECT * FROM products WHERE is_active = 1 AND deal_discount > 0 ORDER BY deal_discount DESC LIMIT 6',
			)
			.all()) as Record<string, unknown>[];

		sendSuccess(res, {
			counts: {
				products: productsCount,
				stores: storesCount,
				orders: ordersCount,
				users: usersCount,
			},
			featured: featuredProducts.map(getProductWithParsedFields),
			deals: dealsProducts.map(getProductWithParsedFields),
		});
	} catch (err) {
		return sendError(res, err);
	}
});
