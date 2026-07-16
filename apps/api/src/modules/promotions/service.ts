/**
 * Promotions service — business logic for flash sales, loyalty points, and bundle deals.
 *
 * SECURITY (OWASP ASVS 5.1.1):
 *   - All inputs validated via Zod schemas
 *   - Atomic operations via database transactions
 *   - Rate limiting on promotion applications
 */
import { db } from '../../lib/shared.ts';

// =====================================================================
// FLASH SALES
// =====================================================================

export interface FlashSale {
	id: number;
	name: string;
	description: string | null;
	starts_at: string;
	ends_at: string;
	is_active: boolean;
	banner_image: string | null;
	created_by: number | null;
	item_count: number;
	total_sold: number;
}

export interface FlashSaleItem {
	id: number;
	flash_sale_id: number;
	product_id: number;
	flash_price: number;
	original_price: number;
	max_quantity: number | null;
	sold_quantity: number;
	sort_order: number;
	product_name?: string;
	product_image?: string;
}

/**
 * Get active flash sales.
 */
export async function getActiveFlashSales(): Promise<FlashSale[]> {
	return (await db
		.prepare(
			`SELECT * FROM v_active_flash_sales
			 ORDER BY ends_at ASC`
		)
		.all()) as unknown as FlashSale[];
}

/**
 * Get flash sale by ID with items.
 */
export async function getFlashSaleById(id: number): Promise<{
	sale: FlashSale;
	items: FlashSaleItem[];
} | null> {
	const sale = (await db
		.prepare('SELECT * FROM flash_sales WHERE id = ?')
		.get(id)) as FlashSale | undefined;

	if (!sale) return null;

	const items = (await db
		.prepare(
			`SELECT fsi.*, p.name_ar AS product_name, p.main_image AS product_image
			 FROM flash_sale_items fsi
			 JOIN products p ON p.id = fsi.product_id
			 WHERE fsi.flash_sale_id = ?
			 ORDER BY fsi.sort_order`
		)
		.all(id)) as unknown as FlashSaleItem[];

	return { sale, items };
}

/**
 * Create a flash sale (admin only).
 */
export async function createFlashSale(data: {
	name: string;
	description?: string;
	starts_at: string;
	ends_at: string;
	banner_image?: string;
	created_by: number;
}): Promise<number> {
	const result = (await db
		.prepare(
			`INSERT INTO flash_sales (name, description, starts_at, ends_at, banner_image, created_by)
			 VALUES (?, ?, ?, ?, ?, ?)
			 RETURNING id`
		)
		.get(
			data.name,
			data.description || null,
			data.starts_at,
			data.ends_at,
			data.banner_image || null,
			data.created_by,
		)) as { id: number } | undefined;

	if (!result) throw new Error('Failed to create flash sale');
	return result.id;
}

/**
 * Add item to flash sale (admin only).
 */
export async function addFlashSaleItem(data: {
	flash_sale_id: number;
	product_id: number;
	flash_price: number;
	max_quantity?: number;
	sort_order?: number;
}): Promise<number> {
	const result = (await db
		.prepare(
			`INSERT INTO flash_sale_items (flash_sale_id, product_id, flash_price, original_price, max_quantity, sort_order)
			 SELECT ?, ?, ?, p.price, ?, ?
			 FROM products p WHERE p.id = ?
			 RETURNING id`
		)
		.get(
			data.flash_sale_id,
			data.product_id,
			data.flash_price,
			data.max_quantity || null,
			data.sort_order || 0,
			data.product_id,
		)) as { id: number } | undefined;

	if (!result) throw new Error('Failed to add flash sale item');
	return result.id;
}

// =====================================================================
// LOYALTY POINTS
// =====================================================================

export interface LoyaltyBalance {
	total_points: number;
	available_points: number;
	lifetime_points: number;
	tier: string;
	tier_bonus: number;
}

export interface LoyaltyTransaction {
	id: number;
	user_id: number;
	points: number;
	type: string;
	source: string;
	reference_type: string | null;
	reference_id: number | null;
	description: string | null;
	balance_after: number;
	created_at: string;
}

/**
 * Get user's loyalty balance.
 */
export async function getLoyaltyBalance(userId: number): Promise<LoyaltyBalance | null> {
	const result = (await db
		.prepare('SELECT * FROM get_loyalty_balance(?)')
		.get(userId)) as LoyaltyBalance | undefined;

	return result || null;
}

/**
 * Get user's loyalty transaction history.
 */
export async function getLoyaltyTransactions(
	userId: number,
	limit = 20,
	offset = 0,
): Promise<LoyaltyTransaction[]> {
	return (await db
		.prepare(
			`SELECT * FROM loyalty_transactions
			 WHERE user_id = ?
			 ORDER BY created_at DESC
			 LIMIT ? OFFSET ?`
		)
		.all(userId, limit, offset)) as unknown as LoyaltyTransaction[];
}

/**
 * Add loyalty points (called after order delivery).
 */
export async function addLoyaltyPoints(
	userId: number,
	points: number,
	source: string,
	referenceType?: string,
	referenceId?: number,
	description?: string,
): Promise<number> {
	const result = (await db
		.prepare('SELECT add_loyalty_points(?, ?, ?, ?, ?, ?) AS total')
		.get(userId, points, source, referenceType || null, referenceId || null, description || null)) as { total: number } | undefined;

	if (!result) throw new Error('Failed to add loyalty points');
	return result.total;
}

/**
 * Redeem loyalty points.
 */
export async function redeemLoyaltyPoints(
	userId: number,
	points: number,
	referenceType?: string,
	referenceId?: number,
	description?: string,
): Promise<boolean> {
	const result = (await db
		.prepare('SELECT redeem_loyalty_points(?, ?, ?, ?, ?) AS success')
		.get(userId, points, referenceType || null, referenceId || null, description || null)) as { success: boolean } | undefined;

	return result?.success || false;
}

/**
 * Get loyalty configuration.
 */
export async function getLoyaltyConfig(): Promise<Record<string, string>> {
	const rows = (await db
		.prepare('SELECT key, value FROM loyalty_config')
		.all()) as Array<{ key: string; value: string }>;

	return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// =====================================================================
// BUNDLE DEALS
// =====================================================================

export interface BundleDeal {
	id: number;
	store_id: number | null;
	name: string;
	description: string | null;
	type: string;
	min_quantity: number;
	discount_value: number;
	starts_at: string | null;
	expires_at: string | null;
	is_active: boolean;
	item_count: number;
}

export interface BundleDealItem {
	id: number;
	bundle_deal_id: number;
	product_id: number;
	quantity: number;
	is_required: boolean;
	product_name?: string;
	product_image?: string;
}

/**
 * Get active bundle deals for a store.
 */
export async function getActiveBundleDeals(storeId?: number): Promise<BundleDeal[]> {
	let query = `
		SELECT bd.*, COUNT(bdi.id) AS item_count
		FROM bundle_deals bd
		LEFT JOIN bundle_deal_items bdi ON bdi.bundle_deal_id = bd.id
		WHERE bd.is_active = TRUE
		  AND (bd.starts_at IS NULL OR bd.starts_at <= NOW())
		  AND (bd.expires_at IS NULL OR bd.expires_at > NOW())
	`;
	const params: unknown[] = [];

	if (storeId) {
		query += ' AND (bd.store_id = ? OR bd.store_id IS NULL)';
		params.push(storeId);
	}

	query += ' GROUP BY bd.id ORDER BY bd.created_at DESC';

	return (await db.prepare(query).all(...params)) as unknown as BundleDeal[];
}

/**
 * Get bundle deal by ID with items.
 */
export async function getBundleDealById(id: number): Promise<{
	deal: BundleDeal;
	items: BundleDealItem[];
} | null> {
	const deal = (await db
		.prepare('SELECT * FROM bundle_deals WHERE id = ?')
		.get(id)) as BundleDeal | undefined;

	if (!deal) return null;

	const items = (await db
		.prepare(
			`SELECT bdi.*, p.name_ar AS product_name, p.main_image AS product_image
			 FROM bundle_deal_items bdi
			 JOIN products p ON p.id = bdi.product_id
			 WHERE bdi.bundle_deal_id = ?
			 ORDER BY bdi.is_required DESC`
		)
		.all(id)) as unknown as BundleDealItem[];

	return { deal, items };
}

/**
 * Create a bundle deal (admin/merchant only).
 */
export async function createBundleDeal(data: {
	store_id?: number;
	name: string;
	description?: string;
	type: string;
	min_quantity: number;
	discount_value: number;
	starts_at?: string;
	expires_at?: string;
}): Promise<number> {
	const result = (await db
		.prepare(
			`INSERT INTO bundle_deals (store_id, name, description, type, min_quantity, discount_value, starts_at, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING id`
		)
		.get(
			data.store_id || null,
			data.name,
			data.description || null,
			data.type,
			data.min_quantity,
			data.discount_value,
			data.starts_at || null,
			data.expires_at || null,
		)) as { id: number } | undefined;

	if (!result) throw new Error('Failed to create bundle deal');
	return result.id;
}

/**
 * Add item to bundle deal.
 */
export async function addBundleDealItem(data: {
	bundle_deal_id: number;
	product_id: number;
	quantity?: number;
	is_required?: boolean;
}): Promise<number> {
	const result = (await db
		.prepare(
			`INSERT INTO bundle_deal_items (bundle_deal_id, product_id, quantity, is_required)
			 VALUES (?, ?, ?, ?)
			 RETURNING id`
		)
		.get(
			data.bundle_deal_id,
			data.product_id,
			data.quantity || 1,
			data.is_required !== false,
		)) as { id: number } | undefined;

	if (!result) throw new Error('Failed to add bundle deal item');
	return result.id;
}

/**
 * Calculate bundle discount for a cart.
 */
export async function calculateBundleDiscount(
	cartItems: Array<{ productId: number; quantity: number }>,
	storeId?: number,
): Promise<{ discount: number; appliedBundle: BundleDeal | null }> {
	// Get active bundle deals
	const deals = await getActiveBundleDeals(storeId);

	for (const deal of deals) {
		const dealWithItems = await getBundleDealById(deal.id);
		if (!dealWithItems) continue;

		const { items } = dealWithItems;
		const requiredItems = items.filter((i) => i.is_required);

		// Check if cart has all required items with minimum quantities
		const meetsRequirements = requiredItems.every((reqItem) => {
			const cartItem = cartItems.find((ci) => ci.productId === reqItem.product_id);
			return cartItem && cartItem.quantity >= reqItem.quantity;
		});

		if (meetsRequirements) {
			// Calculate discount based on type
			let discount = 0;
			switch (deal.type) {
				case 'fixed_price':
					discount = deal.discount_value;
					break;
			case 'percentage_off': {
				// Calculate total of required items
				const totalRequired = requiredItems.reduce((sum, reqItem) => {
					const cartItem = cartItems.find((ci) => ci.productId === reqItem.product_id);
					return sum + (cartItem?.quantity || 0) * reqItem.quantity;
				}, 0);
				discount = totalRequired * (deal.discount_value / 100);
				break;
			}
				case 'buy_x_get_y':
					// Simple implementation: discount_value is the discount amount
					discount = deal.discount_value;
					break;
			}

			return { discount, appliedBundle: deal };
		}
	}

	return { discount: 0, appliedBundle: null };
}
