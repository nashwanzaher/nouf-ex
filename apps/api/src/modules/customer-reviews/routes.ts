/**
 * Customer reviews dashboard (P1 fix — 2026-07-12).
 *
 * GET /api/customer/pending-reviews
 *   Returns the items the current customer is eligible to review:
 * delivered order_items that DO NOT yet have a review by this user.
 *
 * GET /api/customer/my-reviews
 *   Returns the reviews written by the current customer.
 *
 * Both endpoints are isolated to req.user!.id (admins CANNOT list a
 * customer's pending reviews here — admin review-tools live under
 * /api/admin/reviews).
 */
import { Router, type Request, type Response } from 'express';
import { db, requireAuth, sendError, sendSuccess } from '../../lib/shared.ts';

export const customerReviewsRouter = Router();

/**
 * GET /api/customer/pending-reviews
 * Returns the products the current customer has received but not yet
 * reviewed. Each row also includes the order number + store name so the
 * UI can show "Sidr Honey — ordered on 5 June (Al-Rawabi Honey)" without
 * a second round-trip.
 */
customerReviewsRouter.get('/pending-reviews', requireAuth, async (req: Request, res: Response) => {
	try {
		const customerId = req.user!.id;
		const rows = (await db
			.prepare(
				`SELECT
					oi.id            AS order_item_id,
					oi.order_id      AS order_id,
					oi.product_id    AS product_id,
					oi.quantity      AS quantity,
					o.order_number   AS order_number,
					o.delivered_at   AS delivered_at,
					o.created_at     AS ordered_at,
					p.name_en        AS product_name_en,
					p.name_ar        AS product_name_ar,
					p.main_image     AS main_image,
					s.id             AS store_id,
					s.store_name     AS store_name
				 FROM order_items oi
				 JOIN orders o  ON oi.order_id  = o.id
				 JOIN products p ON oi.product_id = p.id
				 JOIN stores s  ON o.store_id   = s.id
				 LEFT JOIN reviews r
				        ON r.product_id  = oi.product_id
				        AND r.customer_id = o.customer_id
				 WHERE o.customer_id = ?
				   AND o.status      = 'delivered'
				   AND o.deleted_at  IS NULL
				   AND oi.deleted_at IS NULL
				   AND r.id IS NULL
				 ORDER BY o.delivered_at DESC NULLS LAST, o.created_at DESC
				 LIMIT 50`,
			)
			.all(customerId)) as Array<Record<string, unknown>>;
		sendSuccess(res, rows);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * GET /api/customer/my-reviews
 * Returns the reviews the current customer has written. Includes the
 * product name + store name + merchant reply for the dashboard list.
 */
customerReviewsRouter.get('/my-reviews', requireAuth, async (req: Request, res: Response) => {
	try {
		const customerId = req.user!.id;
		const rows = (await db
			.prepare(
				`SELECT
					r.id              AS id,
					r.product_id      AS product_id,
					r.store_id        AS store_id,
					r.rating          AS rating,
					r.title           AS title,
					r.comment         AS comment,
					r.images          AS images,
					r.is_verified     AS is_verified,
					r.is_visible      AS is_visible,
					r.merchant_reply  AS merchant_reply,
					r.merchant_replied_at AS merchant_replied_at,
					r.created_at      AS created_at,
					r.updated_at      AS updated_at,
					p.name_en         AS product_name_en,
					p.name_ar         AS product_name_ar,
					p.main_image      AS main_image,
					s.store_name      AS store_name
				 FROM reviews r
				 JOIN products p ON r.product_id = p.id
				 JOIN stores s  ON r.store_id   = s.id
				 WHERE r.customer_id = ?
				 ORDER BY r.created_at DESC
				 LIMIT 100`,
			)
			.all(customerId)) as Array<Record<string, unknown>>;
		sendSuccess(res, rows);
	} catch (err) {
		return sendError(res, err);
	}
});
