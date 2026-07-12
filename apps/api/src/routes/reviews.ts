/**
 * Reviews �?� public list + authenticated submit.
 *
 * P0-3 fix: only return *visible* reviews. Hidden reviews (spam,
 * moderation queue, soft-deleted) must not leak through the public
 * listing.
 *
 * POST /api/reviews is a verified-purchase endpoint: the reviewer must
 * have ordered the product in the past. A successful insert also
 * refreshes the product's `rating` and `review_count` columns (the
 * `trg_reviews_refresh_rating` trigger does the same on direct UPDATEs,
 * but this path bypasses the trigger and needs the explicit refresh).
 */
import { Router, type Request, type Response } from 'express';
import { ErrorCodes } from '../lib/error-codes.ts';
import { db, log, requireAuth, reviewSchema, sendError, sendSuccess, validate } from '../lib/shared.ts';

export const reviewsRouter = Router();

reviewsRouter.get('/', async (req: Request, res: Response) => {
	try {
		const { productId, storeId, limit, offset } = req.query;

		let sql = `SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar,
					  p.name_en as product_name, s.store_name as store_name
			   FROM reviews r
			   LEFT JOIN users u ON r.customer_id = u.id
			   LEFT JOIN products p ON r.product_id = p.id
			   LEFT JOIN stores s ON r.store_id = s.id
			   WHERE r.is_visible = TRUE`;
		const params: unknown[] = [];

		if (productId) {
			const pid = Number(productId);
			if (!Number.isInteger(pid) || pid <= 0) {
				return sendError(res, 'Invalid productId', 400);
			}
			sql += ' AND r.product_id = ?';
			params.push(pid);
		}
		if (storeId) {
			const sid = Number(storeId);
			if (!Number.isInteger(sid) || sid <= 0) {
				return sendError(res, 'Invalid storeId', 400);
			}
			sql += ' AND r.store_id = ?';
			params.push(sid);
		}

		sql += ' ORDER BY r.created_at DESC';

		// Pagination with defaults
		const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
		const off = Math.max(Number(offset) || 0, 0);
		sql += ' LIMIT ? OFFSET ?';
		params.push(lim, off);

		const reviews = await db.prepare(sql).all(...params);
		sendSuccess(res, reviews);
	} catch (err) {
		return sendError(res, err);
	}
});

reviewsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(reviewSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { productId, storeId, rating, title, comment } = v.data;
		// Source of truth = authenticated user. Ignore customerId in body.
		const customerId = req.user!.id;

	// Verified-purchase guard: only delivered order items count.
		const purchased = (await db
			.prepare(
				`SELECT 1 AS found FROM order_items oi
				 JOIN orders o ON oi.order_id = o.id
				WHERE o.customer_id = ? AND oi.product_id = ? AND o.status = 'delivered'
				LIMIT 1`,
			)
			.get(customerId, productId)) as { found: 1 } | undefined;
		const isVerified = Boolean(purchased);

		// Prevent duplicate reviews: one review per customer per product.
		const existingReview = (await db
			.prepare(
				'SELECT id FROM reviews WHERE product_id = ? AND customer_id = ?',
			)
			.get(productId, customerId)) as { id: number } | undefined;
		if (existingReview) {
			return sendError(res, 'You have already reviewed this product', 409, 'DUPLICATE_REVIEW');
		}

		// Look up the product's store_id. reviews.store_id is NOT NULL, so we
		// must derive it server-side from the product. The client-supplied
		// storeId (if any) is only used as a sanity check.
		const productRow = (await db
			.prepare('SELECT store_id FROM products WHERE id = ? AND deleted_at IS NULL')
			.get(productId)) as { store_id: number } | undefined;
		if (!productRow) return sendError(res, 'Product not found', 404);
		const resolvedStoreId = productRow.store_id;
		if (storeId !== undefined && storeId !== resolvedStoreId) {
			return sendError(res, 'storeId does not match product', 400, 'STORE_MISMATCH');
		}

	const result = (await db
			.prepare(
				`INSERT INTO reviews (product_id, store_id, customer_id, rating, title, comment, helpful_count, is_verified, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				 RETURNING id`,
			)
			.get(
				productId,
				resolvedStoreId,
				customerId,
				rating,
				title ?? null,
				comment ?? null,
				isVerified,
			)) as { id: number } | undefined;
		if (!result) {
			return sendError(res, 'Failed to create review', 500, ErrorCodes.INSERT_FAILED);
		}

		// Refresh product rating. Visible reviews only.
		const ratingData = (await db
			.prepare(
				'SELECT AVG(rating)::numeric as avg_rating, COUNT(*) as count FROM reviews WHERE product_id = ? AND is_visible = TRUE',
			)
			.get(productId)) as { avg_rating: number | string; count: number };

		// pg returns AVG() as a string by default; coerce to a JS number for
		// toFixed() and the products.rating column.
		const avg = Number(ratingData.avg_rating) || 0;
		await db
			.prepare('UPDATE products SET rating = ?, review_count = ? WHERE id = ?')
			.run(avg.toFixed(1), ratingData.count, productId);

		// Fire bilingual i18n notification to the merchant (best-effort).
		// (C.1 in MASTER_PLAN.md �?� real review-posted notification)
		try {
			const { onReviewPosted } = await import('../lib/notifications/events.ts');
			const productInfo = (await db
				.prepare('SELECT name_en, name_ar, store_id FROM products WHERE id = ?')
				.get(productId)) as
				| { name_en: string | null; name_ar: string; store_id: number }
				| undefined;
			if (productInfo) {
				const storeRow = (await db
					.prepare('SELECT owner_id FROM stores WHERE id = ?')
					.get(productInfo.store_id)) as { owner_id: number } | undefined;
				if (storeRow) {
					await onReviewPosted({
						productId,
						productName: productInfo.name_en ?? productInfo.name_ar,
						merchantId: storeRow.owner_id,
						rating,
						comment: comment ?? undefined,
					});
				}
			}
		} catch (notifyErr) {
			log.error({ msg: 'reviews.notification_dispatch_failed', error: (notifyErr as Error).message });
		}

		sendSuccess(res, { id: (result as { id: number }).id }, 'Review submitted successfully');
	} catch (err) {
		return sendError(res, err);
	}
});
