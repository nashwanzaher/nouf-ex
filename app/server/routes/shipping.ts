/**
 * Shipping methods — public, no auth.
 *
 * Lists every active shipping method, with an `estimated_total` field
 * that pre-computes the cost for the supplied weight (defaults to 1 kg).
 * The total is rounded to 2 decimal places; `Math.round` is used because
 * the values are already finite positive numbers from PostgreSQL.
 */
import { Router, type Request, type Response } from 'express';
import { db, sendSuccess, sendError } from '../lib/shared.ts';

export const shippingRouter = Router();

shippingRouter.get('/methods', async (req: Request, res: Response) => {
	try {
		const weight = Math.max(0, Number(req.query.weight_kg) || 1);
		const rows = (await db
			.prepare(
				'SELECT id, name_ar, name_en, base_cost, per_kg_cost, estimated_days FROM shipping_methods WHERE is_active = TRUE ORDER BY base_cost ASC',
			)
			.all()) as Array<{
			id: number;
			name_ar: string;
			name_en: string;
			base_cost: number;
			per_kg_cost: number | null;
			estimated_days: number | null;
		}>;
		const enriched = rows.map((m) => ({
			...m,
			estimated_total: Math.round((m.base_cost + (m.per_kg_cost ?? 0) * weight) * 100) / 100,
		}));
		sendSuccess(res, enriched);
	} catch (err) {
		return sendError(res, err);
	}
});
