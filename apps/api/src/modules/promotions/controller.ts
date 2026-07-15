/**
 * Promotions controller — HTTP handlers for flash sales, loyalty points, and bundle deals.
 *
 * SECURITY (OWASP ASVS 5.1.1):
 *   - All inputs validated via Zod schemas
 *   - Role-based access control
 *   - Rate limiting on sensitive operations
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ErrorCodes } from '../../lib/error-codes.ts';
import { sendError, sendSuccess, validate } from '../../lib/shared.ts';
import * as service from './service.ts';

// =====================================================================
// ZOD SCHEMAS
// =====================================================================

const flashSaleCreateSchema = z.object({
	name: z.string().trim().min(1).max(200),
	description: z.string().trim().max(1000).optional(),
	starts_at: z.string().datetime(),
	ends_at: z.string().datetime(),
	banner_image: z.string().url().optional(),
});

const flashSaleItemSchema = z.object({
	product_id: z.number().int().positive(),
	flash_price: z.number().positive(),
	max_quantity: z.number().int().positive().optional(),
	sort_order: z.number().int().nonnegative().optional(),
});

const loyaltyRedeemSchema = z.object({
	points: z.number().int().positive(),
	order_id: z.number().int().positive().optional(),
});

const bundleDealCreateSchema = z.object({
	store_id: z.number().int().positive().optional(),
	name: z.string().trim().min(1).max(200),
	description: z.string().trim().max(1000).optional(),
	type: z.enum(['buy_x_get_y', 'fixed_price', 'percentage_off']),
	min_quantity: z.number().int().min(2).default(2),
	discount_value: z.number().positive(),
	starts_at: z.string().datetime().optional(),
	expires_at: z.string().datetime().optional(),
});

const bundleDealItemSchema = z.object({
	product_id: z.number().int().positive(),
	quantity: z.number().int().positive().default(1),
	is_required: z.boolean().default(true),
});

// =====================================================================
// FLASH SALES HANDLERS
// =====================================================================

/**
 * GET /api/promotions/flash-sales
 * Get active flash sales.
 */
export async function getFlashSalesHandler(_req: Request, res: Response) {
	try {
		const sales = await service.getActiveFlashSales();
		return sendSuccess(res, sales);
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * GET /api/promotions/flash-sales/:id
 * Get flash sale by ID with items.
 */
export async function getFlashSaleHandler(req: Request, res: Response) {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) {
			return sendError(res, 'Invalid flash sale ID', 400, ErrorCodes.VALIDATION_ERROR);
		}

		const result = await service.getFlashSaleById(id);
		if (!result) {
			return sendError(res, 'Flash sale not found', 404, ErrorCodes.NOT_FOUND);
		}

		return sendSuccess(res, result);
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * POST /api/promotions/flash-sales
 * Create a flash sale (admin only).
 */
export async function createFlashSaleHandler(req: Request, res: Response) {
	try {
		const v = validate(flashSaleCreateSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}

		const id = await service.createFlashSale({
			...v.data,
			created_by: req.user!.id,
		});

		return sendSuccess(res, { id }, 201);
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * POST /api/promotions/flash-sales/:id/items
 * Add item to flash sale (admin only).
 */
export async function addFlashSaleItemHandler(req: Request, res: Response) {
	try {
		const flashSaleId = Number(req.params.id);
		if (!Number.isInteger(flashSaleId) || flashSaleId <= 0) {
			return sendError(res, 'Invalid flash sale ID', 400, ErrorCodes.VALIDATION_ERROR);
		}

		const v = validate(flashSaleItemSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}

		const id = await service.addFlashSaleItem({
			flash_sale_id: flashSaleId,
			...v.data,
		});

		return sendSuccess(res, { id }, 201);
	} catch (err) {
		return sendError(res, err);
	}
}

// =====================================================================
// LOYALTY POINTS HANDLERS
// =====================================================================

/**
 * GET /api/promotions/loyalty/balance
 * Get user's loyalty balance.
 */
export async function getLoyaltyBalanceHandler(req: Request, res: Response) {
	try {
		const balance = await service.getLoyaltyBalance(req.user!.id);
		if (!balance) {
			return sendSuccess(res, {
				total_points: 0,
				available_points: 0,
				lifetime_points: 0,
				tier: 'bronze',
				tier_bonus: 1.0,
			});
		}

		return sendSuccess(res, balance);
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * GET /api/promotions/loyalty/transactions
 * Get user's loyalty transaction history.
 */
export async function getLoyaltyTransactionsHandler(req: Request, res: Response) {
	try {
		const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
		const offset = Math.max(0, Number(req.query.offset) || 0);

		const transactions = await service.getLoyaltyTransactions(
			req.user!.id,
			limit,
			offset,
		);

		return sendSuccess(res, { transactions, limit, offset });
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * POST /api/promotions/loyalty/redeem
 * Redeem loyalty points.
 */
export async function redeemLoyaltyPointsHandler(req: Request, res: Response) {
	try {
		const v = validate(loyaltyRedeemSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}

		const success = await service.redeemLoyaltyPoints(
			req.user!.id,
			v.data.points,
			'order',
			v.data.order_id,
			'Redeemed for order discount',
		);

		if (!success) {
			return sendError(res, 'Insufficient loyalty points', 400, ErrorCodes.VALIDATION_ERROR);
		}

		return sendSuccess(res, { redeemed: true, points: v.data.points });
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * GET /api/promotions/loyalty/config
 * Get loyalty configuration.
 */
export async function getLoyaltyConfigHandler(_req: Request, res: Response) {
	try {
		const config = await service.getLoyaltyConfig();
		return sendSuccess(res, config);
	} catch (err) {
		return sendError(res, err);
	}
}

// =====================================================================
// BUNDLE DEALS HANDLERS
// =====================================================================

/**
 * GET /api/promotions/bundles
 * Get active bundle deals.
 */
export async function getBundleDealsHandler(req: Request, res: Response) {
	try {
		const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
		const deals = await service.getActiveBundleDeals(storeId);
		return sendSuccess(res, deals);
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * GET /api/promotions/bundles/:id
 * Get bundle deal by ID with items.
 */
export async function getBundleDealHandler(req: Request, res: Response) {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) {
			return sendError(res, 'Invalid bundle deal ID', 400, ErrorCodes.VALIDATION_ERROR);
		}

		const result = await service.getBundleDealById(id);
		if (!result) {
			return sendError(res, 'Bundle deal not found', 404, ErrorCodes.NOT_FOUND);
		}

		return sendSuccess(res, result);
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * POST /api/promotions/bundles
 * Create a bundle deal (admin/merchant only).
 */
export async function createBundleDealHandler(req: Request, res: Response) {
	try {
		const v = validate(bundleDealCreateSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}

		const id = await service.createBundleDeal(v.data);
		return sendSuccess(res, { id }, 201);
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * POST /api/promotions/bundles/:id/items
 * Add item to bundle deal (admin/merchant only).
 */
export async function addBundleDealItemHandler(req: Request, res: Response) {
	try {
		const bundleDealId = Number(req.params.id);
		if (!Number.isInteger(bundleDealId) || bundleDealId <= 0) {
			return sendError(res, 'Invalid bundle deal ID', 400, ErrorCodes.VALIDATION_ERROR);
		}

		const v = validate(bundleDealItemSchema, req.body);
		if (!v.ok) {
			return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		}

		const id = await service.addBundleDealItem({
			bundle_deal_id: bundleDealId,
			...v.data,
		});

		return sendSuccess(res, { id }, 201);
	} catch (err) {
		return sendError(res, err);
	}
}

/**
 * POST /api/promotions/bundles/calculate
 * Calculate bundle discount for a cart.
 */
export async function calculateBundleDiscountHandler(req: Request, res: Response) {
	try {
		const { items, store_id } = req.body;

		if (!Array.isArray(items) || items.length === 0) {
			return sendError(res, 'Items array is required', 400, ErrorCodes.VALIDATION_ERROR);
		}

		const result = await service.calculateBundleDiscount(items, store_id);
		return sendSuccess(res, result);
	} catch (err) {
		return sendError(res, err);
	}
}
