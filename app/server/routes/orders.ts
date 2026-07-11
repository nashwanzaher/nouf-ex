import { randomUUID } from 'crypto';
import { Router, type Request, type Response } from 'express';
import type { PgTxDb } from '../db/pg-wrapper.ts';
import { ErrorCodes } from '../lib/error-codes.ts';
import { getSetting } from '../lib/settings.ts';
import {
	COUPON_COLUMNS,
	HttpError,
	computeCouponDiscount,
	db,
	log,
	orderSchema,
	requireAuth,
	resolveOrderStoreId,
	sendError,
	sendSuccess,
	validate,
	type CouponRow,
} from '../lib/shared.ts';

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
         WHERE o.id = ?`,
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
         WHERE oi.order_id = ?`,
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
			couponCode,
		} = v.data as {
			storeId?: number;
			items: Array<{
				productId: number;
				quantity: number;
				variant?: unknown;
			}>;
			shippingAddress?: unknown;
			paymentMethod?: string;
			notes?: string;
			couponCode?: string;
		};
		const customerId = req.user!.id;

		// SECURITY (C-1): the body MUST NOT carry pricing. We pull the
		// authoritative price, currency, and variant price_delta straight
		// from the DB inside the order transaction so a tampered client
		// can never underpay or overpay. `subtotal` / `shippingCost` /
		// `total` are intentionally NOT read from `v.data`; the server
		// recomputes them below.
		const productIds = items.map((i) => i.productId);
		const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
		const productRows = (await db
			.prepare(
				`SELECT id, store_id, is_active, deleted_at, price, currency, stock, name_en, name_ar
				   FROM products
				  WHERE id IN (${placeholders})
				  ORDER BY id`,
			)
			.all(...productIds)) as Array<{
			id: number;
			store_id: number;
			is_active: boolean;
			deleted_at: string | null;
			price: string;
			currency: string;
			stock: number;
			name_en: string | null;
			name_ar: string;
		}>;
		const storeResult = resolveOrderStoreId(productIds, productRows);
		if (!storeResult.ok) {
			if (storeResult.code === 'PRODUCT_UNAVAILABLE') {
				return sendError(
					res,
					`Product ${storeResult.productId} is unavailable`,
					400,
					'PRODUCT_UNAVAILABLE',
				);
			}
			if (storeResult.code === 'MIXED_STORES') {
				return sendError(
					res,
					'All items in an order must come from a single store. Split the cart and try again.',
					400,
					'MIXED_STORES',
				);
			}
			return sendError(res, 'No products to order.', 400, 'EMPTY_CART');
		}
		const resolvedStoreId = storeResult.storeId;

		// Stock check BEFORE we begin the transaction — gives a cheaper
		// 400 path than waiting for the FOR UPDATE inside the tx. The
		// trigger re-validates stock on insert (race-safe).
		const productById = new Map<
			number,
			{
				price: number;
				currency: string;
				stock: number;
				name_ar: string;
				name_en: string | null;
			}
		>();
		for (const p of productRows) {
			productById.set(p.id, {
				price: Number(p.price),
				currency: p.currency,
				stock: p.stock,
				name_ar: p.name_ar,
				name_en: p.name_en,
			});
		}
		for (const item of items) {
			const product = productById.get(item.productId);
			if (!product) {
				return sendError(
					res,
					`Product ${item.productId} is unavailable`,
					400,
					'PRODUCT_UNAVAILABLE',
				);
			}
			if (product.stock < item.quantity) {
				return sendError(
					res,
					`Product ${item.productId} has insufficient stock (requested ${item.quantity}, available ${product.stock})`,
					400,
					'OUT_OF_STOCK',
				);
			}
		}

		const normalisedPaymentMethod =
			paymentMethod === 'cash' || !paymentMethod ? 'cod' : paymentMethod;

		// Server-side authoritative pricing. `shippingCost` is intentionally
		// fixed for now (free shipping policy); once a shipping_methods
		// lookup is wired in we will resolve it per order the same way.
		//
		// P1-2 (2026-07-04): the threshold and flat cost used to be
		// hardcoded literals (10000 / 500 / 'YER'). They now read
		// from the `app_settings` table (migration 0023) via
		// `getSetting()`. The values are read at the top of the
		// request handler so a single DB round-trip serves this
		// request (60s in-process cache makes subsequent requests
		// zero-cost).
		//
		// The settings module falls back to the canonical
		// ('YER', '10000', '500') defaults on DB error, so a DB
		// outage degrades gracefully to the old behaviour.
		const [defaultCurrencyRaw, freeShipRaw, flatShipRaw] = await Promise.all([
			getSetting('DEFAULT_CURRENCY'),
			getSetting('FREE_SHIPPING_THRESHOLD'),
			getSetting('FLAT_SHIPPING_COST'),
		]);
		const FREE_SHIPPING_THRESHOLD = Number.parseInt(freeShipRaw, 10) || 10000;
		const FLAT_SHIPPING_COST = Number.parseInt(flatShipRaw, 10) || 500;
		const DEFAULT_CURRENCY = defaultCurrencyRaw || 'YER';
		let resolvedSubtotal = 0;
		for (const item of items) {
			const product = productById.get(item.productId)!;
			resolvedSubtotal += product.price * item.quantity;
		}
		resolvedSubtotal = Math.round(resolvedSubtotal * 100) / 100;
		const resolvedShippingCost =
			resolvedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COST;
		let resolvedDiscount = 0;
		const resolvedCouponCode: string | null = couponCode ? String(couponCode) : null;
		if (resolvedCouponCode && resolvedSubtotal <= 0) {
			return sendError(res, 'Cannot apply a coupon without a positive subtotal.', 400);
		}

		const {
			id: orderId,
			orderNumber,
			finalDiscount,
			finalTotal,
		} = await db.tx(async (txDb: PgTxDb) => {
			if (resolvedCouponCode) {
				const coupon = (await txDb
					.prepare(
						`SELECT ${COUPON_COLUMNS}
                             FROM coupons
                            WHERE code = ? AND is_active = TRUE
                            FOR UPDATE`,
					)
					.get(resolvedCouponCode)) as CouponRow | undefined;
				if (!coupon) {
					throw new HttpError(400, 'Coupon not found or inactive.', { code: ErrorCodes.NOT_FOUND });
				}
				if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
					throw new HttpError(400, 'Coupon has expired.', { code: ErrorCodes.VALIDATION_ERROR });
				}
				if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
					throw new HttpError(400, 'Coupon is not yet active.', { code: ErrorCodes.VALIDATION_ERROR });
				}
				if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
					throw new HttpError(409, 'Coupon usage limit reached.', { code: ErrorCodes.CONFLICT });
				}
				const userUsageRow = (await txDb
					.prepare(
						`SELECT COUNT(*)::int AS c FROM coupon_usage WHERE coupon_id = ? AND user_id = ?`,
					)
					.get(coupon.id, customerId)) as { c: number } | undefined;
				const userUsageCount = userUsageRow?.c ?? 0;
				if (userUsageCount >= coupon.per_user_limit) {
					throw new HttpError(409, 'Coupon usage limit reached for this account.', { code: ErrorCodes.CONFLICT });
				}
				if (coupon.min_order != null && resolvedSubtotal < coupon.min_order) {
					throw new HttpError(400, `Minimum order for this coupon is ${coupon.min_order.toLocaleString()}.`, { code: ErrorCodes.VALIDATION_ERROR });
				}
				resolvedDiscount = await computeCouponDiscount(coupon, resolvedSubtotal);
			}
			const finalDiscount = Math.round(resolvedDiscount * 100) / 100;
			const finalTotal = Math.max(
				0,
				Math.round((resolvedSubtotal + resolvedShippingCost - finalDiscount) * 100) / 100,
			);

			const orderNumber = `ORD-${randomUUID().slice(0, 8).toUpperCase()}`;
			// NOTE: both `discount` and `discount_amount` columns store the same value.
			// This is a schema redundancy (both columns exist in orders table).
			// We set both to finalDiscount for backward compatibility.
			const result = (await txDb
				.prepare(
					`INSERT INTO orders
				(customer_id, store_id, order_number, status, payment_method,
			         payment_status, subtotal, shipping_cost, discount,
			         coupon_code, discount_amount, total, currency,
			         shipping_address, notes)
			       VALUES (?, ?, ?, 'pending', ?, 'pending',
			               ?, ?, ?, ?, ?, ?, ?,
			               ?, ?)
			       RETURNING id`,
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
					DEFAULT_CURRENCY,
					JSON.stringify(shippingAddress),
					notes || null,
				)) as { lastInsertRowid: number | null };
			if (result.lastInsertRowid == null) {
				throw new HttpError(500, 'Failed to create order', {
					code: ErrorCodes.INSERT_FAILED,
				});
			}
			const newOrderId: number = result.lastInsertRowid;

			// SECURITY (C-1): inside the transaction we re-fetch products
			// and compute the authoritative unit_price server-side. We
			// never read `item.unitPrice` from the client body — the
			// schema strips it and we re-derive it here from `products`.
			const productIds = items.map((i) => i.productId);
			const productRows = (await txDb
				.prepare(
					`SELECT id, name_ar, name_en, price, currency, stock, moq
						 FROM products
						WHERE id = ANY($1) AND is_active = TRUE AND deleted_at IS NULL
						FOR UPDATE`,
				)
				.all(productIds)) as Array<{
				id: number;
				name_ar: string;
				name_en: string | null;
				price: string;
				currency: string;
				stock: number;
				moq: number;
			}>;
			const productById = new Map<
				number,
				{
					name_ar: string;
					name_en: string | null;
					price: number;
					currency: string;
					stock: number;
					moq: number;
				}
			>();
			for (const p of productRows) {
				productById.set(p.id, {
					name_ar: p.name_ar,
					name_en: p.name_en,
					price: Number(p.price),
					currency: p.currency,
					stock: p.stock,
					moq: p.moq,
				});
			}

			const insertItem = txDb.prepare(
				`INSERT INTO order_items
			        (order_id, product_id, variant_id, product_name, quantity,
			         unit_price, total_price)
			       VALUES (?, ?, ?, ?, ?, ?, ?)`,
			);

			let serverSubtotal = 0;
			for (const item of items) {
				if (item.quantity <= 0) {
					throw new Error(
						`Invalid quantity ${item.quantity} for product ${item.productId}`,
					);
				}
				const product = productById.get(item.productId);
				if (!product) {
					throw new Error(`Product ${item.productId} is unavailable`);
				}
				if (item.quantity < product.moq) {
					throw new Error(
						`Product ${item.productId} requires a minimum order quantity of ${product.moq}`,
					);
				}
				if (product.stock < item.quantity) {
					throw new Error(
						`Product ${item.productId} has insufficient stock (requested ${item.quantity}, available ${product.stock})`,
					);
				}
				// unit_price is ALWAYS taken from the DB row, never from the
				// request body. This is the heart of the C-1 fix.
				const unitPrice = product.price;
				const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
				serverSubtotal += lineTotal;
				await insertItem.run(
					newOrderId,
					item.productId,
					null,
					product.name_en || product.name_ar,
					item.quantity,
					unitPrice,
					lineTotal,
				);
			}
			serverSubtotal = Math.round(serverSubtotal * 100) / 100;
			// Use the server-computed subtotal — never trust the client.
			// We recompute the totals here to make tampering impossible.
			// The threshold + flat cost come from the same top-of-handler
			// `getSetting(...)` cache as the initial INSERT block.
			const serverDiscount = Math.round(resolvedDiscount * 100) / 100;
			const serverShippingCost =
				serverSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COST;
			const serverFinalTotal = Math.max(
				0,
				Math.round((serverSubtotal + serverShippingCost - serverDiscount) * 100) / 100,
			);
			// Patch the order header row with the authoritative numbers.
			await txDb
				.prepare(
					`UPDATE orders
					    SET subtotal = ?, shipping_cost = ?, discount = ?, total = ?
					  WHERE id = ?`,
				)
				.run(
					serverSubtotal,
					serverShippingCost,
					serverDiscount,
					serverFinalTotal,
					newOrderId,
				);
			return {
				id: newOrderId,
				orderNumber,
				finalDiscount: serverDiscount,
				finalTotal: serverFinalTotal,
			};
		});

		sendSuccess(
			res,
			{ id: orderId, orderNumber, discount: finalDiscount, total: finalTotal },
			'Order created successfully',
		);

		// Fire bilingual i18n notifications to the customer AND the merchant
		// AFTER the transaction has committed. We do this best-effort: any
		// failure here is logged but never blocks the order response.
		// (C.1 in MASTER_PLAN.md — real notifications with i18n + merchant alert)
		try {
			const { onOrderPlaced } = await import('../lib/notifications/events.ts');
			// Look up the merchant (store owner) and a product display name
			// for the notification body.
			const [storeRow, firstProductRow] = await Promise.all([
				db
					.prepare('SELECT owner_id, store_name FROM stores WHERE id = ?')
					.get(resolvedStoreId) as Promise<
					{ owner_id: number; store_name: string } | undefined
				>,
				items.length >= 1
					? (db
							.prepare('SELECT name_en, name_ar FROM products WHERE id = $1')
							.get(items[0].productId) as Promise<
							{ name_en: string | null; name_ar: string } | undefined
						>)
					: Promise.resolve(undefined),
			]);
			const merchantId = storeRow?.owner_id;
			const productName =
				firstProductRow?.name_en ??
				firstProductRow?.name_ar ??
				(items.length === 1 ? 'item' : `${items.length} items`);
			if (merchantId) {
				await onOrderPlaced({
					orderId,
					customerId,
					merchantId,
					orderNumber,
					total: finalTotal,
					itemCount: items.length,
					paymentMethod: normalisedPaymentMethod,
					trackingUrl: `https://noufex.example.com/orders/${orderId}`,
					productName,
				});
			}
		} catch (notifyErr) {
			log.error({
				msg: 'orders.notification_dispatch_failed',
				error: (notifyErr as Error).message,
			});
		}
	} catch (err) {
		return sendError(res, err);
	}
});
