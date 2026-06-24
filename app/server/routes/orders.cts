import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import {
	db,
	sendSuccess,
	sendError,
	validate,
	requireAuth,
	HttpError,
	orderSchema,
	resolveOrderStoreId,
	COUPON_COLUMNS,
	computeCouponDiscount,
	type CouponRow,
} from '../lib/shared.cts';

export const ordersRouter = Router();

ordersRouter.get('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const isAdmin = req.user!.role === 'admin';
		const requestedCustomerId = req.query.customerId ? Number(req.query.customerId) : null;

		let sql = `SELECT o.*, s.store_name as store_name, s.logo as store_logo
               FROM orders o
               LEFT JOIN stores s ON o.store_id = s.id
               WHERE 1=1`;
		const params: number[] = [];

		if (isAdmin && requestedCustomerId && Number.isInteger(requestedCustomerId)) {
			sql += ' AND o.customer_id = ?';
			params.push(requestedCustomerId);
		} else {
			sql += ' AND o.customer_id = ?';
			params.push(req.user!.id);
		}

		sql += ' ORDER BY o.created_at DESC';

		const orders = await db.prepare(sql).all(...params);
		sendSuccess(res, orders);
	} catch (err) {
		return sendError(res, err);
	}
});

ordersRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
	try {
		const orderId = Number(req.params.id);

		const order = (await db
			.prepare(
				`SELECT o.*, s.store_name as store_name, s.logo as store_logo
         FROM orders o
         LEFT JOIN stores s ON o.store_id = s.id
         WHERE o.id = ?`
			)
			.get(orderId)) as (Record<string, unknown> & { customer_id: number }) | undefined;

		if (!order) {
			return sendError(res, 'Order not found', 404);
		}

		if (req.user!.role !== 'admin' && order.customer_id !== req.user!.id) {
			return sendError(res, 'Forbidden', 403);
		}

		const items = (await db
			.prepare(
				`SELECT oi.*, p.name_en as product_name, p.name_ar as product_name_ar, p.main_image as product_image
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`
			)
			.all(orderId)) as Record<string, unknown>[];

		sendSuccess(res, { ...order, items });
	} catch (err) {
		return sendError(res, err);
	}
});

ordersRouter.post('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(orderSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const {
			storeId: _ignoredStoreId,
			items,
			shippingAddress,
			paymentMethod,
			notes,
			subtotal,
			shippingCost,
			total,
			couponCode,
		} = v.data as {
			storeId?: number;
			items: Array<{
				productId: number;
				variantId?: number | null;
				quantity: number;
				unitPrice: number;
			}>;
			shippingAddress: unknown;
			paymentMethod: string;
			notes?: string;
			subtotal: number;
			shippingCost: number;
			discount: number;
			total: number;
			couponCode?: string;
		};
		const customerId = req.user!.id;

		const productIds = items.map((i) => i.productId);
		const productRows = (await db
			.prepare(
				`SELECT id, store_id, is_active, deleted_at
				   FROM products
				  WHERE id = ANY(?)
				  ORDER BY id`
			)
			.all(productIds)) as Array<{
			id: number;
			store_id: number;
			is_active: boolean;
			deleted_at: string | null;
		}>;
		const storeResult = resolveOrderStoreId(productIds, productRows);
		if (!storeResult.ok) {
			if (storeResult.code === 'PRODUCT_UNAVAILABLE') {
				return sendError(
					res,
					`Product ${storeResult.productId} is unavailable`,
					400,
					'PRODUCT_UNAVAILABLE'
				);
			}
			if (storeResult.code === 'MIXED_STORES') {
				return sendError(
					res,
					'All items in an order must come from a single store. Split the cart and try again.',
					400,
					'MIXED_STORES'
				);
			}
			return sendError(res, 'No products to order.', 400, 'EMPTY_CART');
		}
		const resolvedStoreId = storeResult.storeId;

		const normalisedPaymentMethod =
			paymentMethod === 'cash' || !paymentMethod ? 'cod' : paymentMethod;

		const resolvedSubtotal = Math.max(0, Number(subtotal) || Number(total) || 0);
		const resolvedShippingCost = Math.max(0, Number(shippingCost) || 0);
		let resolvedDiscount = 0;
		const resolvedCouponCode: string | null = couponCode ? String(couponCode) : null;
		if (resolvedCouponCode) {
			if (resolvedSubtotal <= 0) {
				return sendError(res, 'Cannot apply a coupon without a positive subtotal.', 400);
			}
		}

		const {
			id: orderId,
			orderNumber,
			finalDiscount,
			finalTotal,
		} = await db.tx(
			async (txDb: {
				prepare: (sql: string) => {
					run: (
						...args: unknown[]
					) => Promise<{ lastInsertRowid: number | string | null; changes: number }>;
					get: (...args: unknown[]) => Promise<unknown>;
				};
			}) => {
				if (resolvedCouponCode) {
					const coupon = (await txDb
						.prepare(
							`SELECT ${COUPON_COLUMNS}
                             FROM coupons
                            WHERE code = ? AND is_active = TRUE
                            FOR UPDATE`
						)
						.get(resolvedCouponCode)) as CouponRow | undefined;
					if (!coupon) {
						throw new Error('Coupon not found or inactive.');
					}
					if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
						throw new Error('Coupon has expired.');
					}
					if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
						throw new Error('Coupon is not yet active.');
					}
					if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
						throw new Error('Coupon usage limit reached.');
					}
					if (coupon.min_order != null && resolvedSubtotal < coupon.min_order) {
						throw new Error(
							`Minimum order for this coupon is ${coupon.min_order.toLocaleString()}.`
						);
					}
					resolvedDiscount = await computeCouponDiscount(coupon, resolvedSubtotal);
				}
				const finalDiscount = Math.round(resolvedDiscount * 100) / 100;
				const finalTotal = Math.max(
					0,
					Math.round((resolvedSubtotal + resolvedShippingCost - finalDiscount) * 100) / 100
				);

				const orderNumber = `ORD-${randomUUID().slice(0, 8).toUpperCase()}`;
				const result = (await txDb
					.prepare(
						`INSERT INTO orders
			        (customer_id, store_id, order_number, status, payment_method,
			         payment_status, subtotal, shipping_cost, discount,
			         coupon_code, discount_amount, total, currency,
			         shipping_address, notes)
			       VALUES (?, ?, ?, 'pending', ?, 'pending',
			               ?, ?, ?, ?, ?, ?, 'YER',
			               ?, ?)
			       RETURNING id`
					)
					.run(
						customerId,
						resolvedStoreId,
						orderNumber,
						normalisedPaymentMethod,
						resolvedSubtotal,
						resolvedShippingCost,
						finalDiscount,
						resolvedCouponCode,
						finalDiscount,
						finalTotal,
						JSON.stringify(shippingAddress),
						notes || null
					)) as { lastInsertRowid: number | null };
				if (result.lastInsertRowid == null) {
					throw new HttpError(500, 'Failed to create order', { code: 'INSERT_FAILED' });
				}
				const newOrderId: number = result.lastInsertRowid;

				const readProduct = txDb.prepare(
					`SELECT name_ar, name_en FROM products WHERE id = ? AND is_active = TRUE AND deleted_at IS NULL`
				);

				const insertItem = txDb.prepare(
					`INSERT INTO order_items
			        (order_id, product_id, variant_id, product_name, quantity,
			         unit_price, total_price)
			       VALUES (?, ?, ?, ?, ?, ?, ?)`
				);

				for (const item of items) {
					if (item.quantity <= 0) {
						throw new Error(`Invalid quantity ${item.quantity} for product ${item.productId}`);
					}
					const product = (await readProduct.get(item.productId)) as
						| { name_ar: string; name_en: string | null }
						| undefined;
					if (!product) {
						throw new Error(`Product ${item.productId} is unavailable`);
					}
					const unitPrice = item.unitPrice;
					await insertItem.run(
						newOrderId,
						item.productId,
						item.variantId ?? null,
						product.name_en || product.name_ar,
						item.quantity,
						unitPrice,
						unitPrice * item.quantity
					);
				}
				return { id: newOrderId, orderNumber, finalDiscount, finalTotal };
			}
		);

		sendSuccess(
			res,
			{ id: orderId, orderNumber, discount: finalDiscount, total: finalTotal },
			'Order created successfully'
		);
	} catch (err) {
		return sendError(res, err);
	}
});
