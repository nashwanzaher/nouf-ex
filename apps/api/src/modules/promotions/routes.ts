/**
 * Promotions routes — flash sales, loyalty points, and bundle deals.
 *
 * SECURITY (OWASP ASVS 5.1.1):
 *   - Public endpoints for viewing promotions
 *   - Authenticated endpoints for loyalty points
 *   - Admin/merchant endpoints for managing promotions
 */
import { Router } from 'express';
import { requireAuth, requireRole, ADMIN_OPERATOR_ROLES } from '../../lib/shared.ts';
import {
	getFlashSalesHandler,
	getFlashSaleHandler,
	createFlashSaleHandler,
	addFlashSaleItemHandler,
	getLoyaltyBalanceHandler,
	getLoyaltyTransactionsHandler,
	redeemLoyaltyPointsHandler,
	getLoyaltyConfigHandler,
	getBundleDealsHandler,
	getBundleDealHandler,
	createBundleDealHandler,
	addBundleDealItemHandler,
	calculateBundleDiscountHandler,
} from './controller.ts';

export const promotionsRouter = Router();

// =====================================================================
// FLASH SALES (public read, admin write)
// =====================================================================
promotionsRouter.get('/flash-sales', getFlashSalesHandler);
promotionsRouter.get('/flash-sales/:id', getFlashSaleHandler);
promotionsRouter.post('/flash-sales', requireAuth, requireRole(...ADMIN_OPERATOR_ROLES), createFlashSaleHandler);
promotionsRouter.post('/flash-sales/:id/items', requireAuth, requireRole(...ADMIN_OPERATOR_ROLES), addFlashSaleItemHandler);

// =====================================================================
// LOYALTY POINTS (authenticated)
// =====================================================================
promotionsRouter.get('/loyalty/balance', requireAuth, getLoyaltyBalanceHandler);
promotionsRouter.get('/loyalty/transactions', requireAuth, getLoyaltyTransactionsHandler);
promotionsRouter.post('/loyalty/redeem', requireAuth, redeemLoyaltyPointsHandler);
promotionsRouter.get('/loyalty/config', getLoyaltyConfigHandler);

// =====================================================================
// BUNDLE DEALS (public read, admin/merchant write)
// =====================================================================
promotionsRouter.get('/bundles', getBundleDealsHandler);
promotionsRouter.get('/bundles/:id', getBundleDealHandler);
promotionsRouter.post('/bundles', requireAuth, requireRole('merchant', ...ADMIN_OPERATOR_ROLES), createBundleDealHandler);
promotionsRouter.post('/bundles/:id/items', requireAuth, requireRole('merchant', ...ADMIN_OPERATOR_ROLES), addBundleDealItemHandler);
promotionsRouter.post('/bundles/calculate', calculateBundleDiscountHandler);
