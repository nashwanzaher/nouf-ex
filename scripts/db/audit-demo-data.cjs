'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');
const {
	DEMO_USER_EMAILS,
	DEMO_STORE_SLUGS,
	DEMO_PRODUCT_IMAGES,
	DEMO_ORDER_NUMBERS,
	DEMO_COUPON_CODES,
} = require('./demo-signatures.cjs');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env'), quiet: true, debug: false });

function resolveDatabaseUrl() {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
	if (DB_HOST && DB_NAME && DB_USER && DB_PASSWORD) {
		return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT || 5432}/${DB_NAME}`;
	}
	throw new Error('DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD is required');
}

async function tableExists(client, table) {
	const result = await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${table}`]);
	return result.rows[0]?.exists === true;
}

async function rows(client, sql, params = []) {
	return (await client.query(sql, params)).rows;
}

async function collectReport(client) {
	await client.query('SET TRANSACTION READ ONLY');
	const available = {};
	for (const table of [
		'users',
		'stores',
		'products',
		'product_images',
		'product_variants',
		'categories',
		'addresses',
		'delivery_agents',
		'orders',
		'order_items',
		'payments',
		'refunds',
		'transactions',
		'reviews',
		'store_followers',
		'wishlist',
		'cart_items',
		'messages',
		'notifications',
		'disputes',
		'admin_audit_log',
		'coupons',
		'coupon_usage',
		'subscriptions',
		'store_balance',
		'shipments',
		'invoices',
		'delivery_agent_assignments',
	]) {
		available[table] = await tableExists(client, table);
	}

	const targetUsers = available.users
		? await rows(
				client,
				'SELECT id, email, role, status, created_at FROM users WHERE lower(email) = ANY($1::text[]) ORDER BY id',
				[DEMO_USER_EMAILS.map((email) => email.toLowerCase())],
			)
		: [];
	const targetUserIds = targetUsers.map((row) => row.id);
	const targetStores = available.stores
		? await rows(
				client,
				'SELECT id, slug, owner_id, is_active, is_verified, created_at FROM stores WHERE slug = ANY($1::text[]) OR owner_id = ANY($2::int[]) ORDER BY id',
				[DEMO_STORE_SLUGS, targetUserIds],
			)
		: [];
	const targetStoreIds = targetStores.map((row) => row.id);
	const storeProducts = available.products && targetStoreIds.length > 0
		? await rows(
				client,
				'SELECT id, store_id, main_image, name_en, is_active, created_at FROM products WHERE store_id = ANY($1::int[]) ORDER BY id',
				[targetStoreIds],
			)
		: [];
	const targetProducts = available.products
		? await rows(
				client,
				'SELECT id, store_id, category_id, main_image, name_en, is_active, created_at FROM products WHERE main_image = ANY($1::text[]) ORDER BY id',
				[DEMO_PRODUCT_IMAGES.map((image) => `/products/${image}`)],
			)
		: [];
	const targetProductIds = targetProducts.map((row) => row.id);
	const targetOrders = available.orders
		? await rows(
				client,
				'SELECT id, order_number, customer_id, store_id, status, payment_status, tracking_number, shipping_company, estimated_delivery, delivered_at, created_at FROM orders WHERE order_number = ANY($1::text[]) ORDER BY id',
				[DEMO_ORDER_NUMBERS],
			)
		: [];
	const targetOrderIds = targetOrders.map((row) => row.id);
	const targetCoupons = available.coupons
		? await rows(
				client,
				'SELECT id, code, is_active, starts_at, expires_at FROM coupons WHERE code = ANY($1::text[]) ORDER BY id',
				[DEMO_COUPON_CODES],
			)
		: [];
	const targetCouponIds = targetCoupons.map((row) => row.id);

	const target = {
		users: targetUsers,
		stores: targetStores,
		store_products: storeProducts,
		products: targetProducts,
		orders: targetOrders,
		coupons: targetCoupons,
	};
	const relations = {};
	const blockers = [];
	for (const order of targetOrders) {
		if (order.payment_status && order.payment_status !== 'pending') {
			blockers.push({ reason: 'order payment status requires financial review', rows: [order] });
		}
		if (order.tracking_number || order.shipping_company || order.estimated_delivery || order.delivered_at) {
			blockers.push({ reason: 'order shipment fields require logistics review', rows: [order] });
		}
	}
	const unexpectedRelations = [];
	const userIds = targetUserIds.length ? targetUserIds : [0];
	const storeIds = targetStoreIds.length ? targetStoreIds : [0];
	const productIds = targetProductIds.length ? targetProductIds : [0];
	const orderIds = targetOrderIds.length ? targetOrderIds : [0];
	const couponIds = targetCouponIds.length ? targetCouponIds : [0];

	for (const store of targetStores) {
		if (!DEMO_STORE_SLUGS.includes(store.slug)) {
			unexpectedRelations.push({ type: 'user_store_not_in_demo_signature', row: store });
		}
	}
	if (available.products) {
		for (const product of storeProducts) {
			if (!DEMO_PRODUCT_IMAGES.includes(String(product.main_image).replace(/^\/products\//, ''))) {
				unexpectedRelations.push({ type: 'store_product_not_in_demo_signature', row: product });
			}
		}
	}
	if (available.orders) {
		const relatedOrders = await rows(
			client,
			'SELECT id, order_number, customer_id, store_id, status, payment_status FROM orders WHERE customer_id = ANY($1::int[]) OR store_id = ANY($2::int[]) ORDER BY id',
			[userIds, storeIds],
		);
		for (const order of relatedOrders) {
			if (!DEMO_ORDER_NUMBERS.includes(order.order_number)) {
				unexpectedRelations.push({ type: 'related_order_not_in_demo_signature', row: order });
			}
		}
	}

	async function relation(name, table, sql, params, reason, isBlocker = false) {
		if (!available[table]) return;
		const result = await rows(client, sql, params);
		relations[name] = result;
		if (isBlocker && result.length > 0) blockers.push({ reason, rows: result });
	}

	await relation('addresses', 'addresses', 'SELECT id, user_id, city, governorate FROM addresses WHERE user_id = ANY($1::int[])', [userIds], 'user address relation');
	await relation('delivery_agents', 'delivery_agents', 'SELECT user_id, status FROM delivery_agents WHERE user_id = ANY($1::int[])', [userIds], 'delivery agent relation');
	await relation('product_images', 'product_images', 'SELECT id, product_id FROM product_images WHERE product_id = ANY($1::int[])', [productIds], 'product image relation');
	await relation('product_variants', 'product_variants', 'SELECT id, product_id FROM product_variants WHERE product_id = ANY($1::int[])', [productIds], 'product variant relation');
	await relation('order_items', 'order_items', 'SELECT id, order_id, product_id FROM order_items WHERE order_id = ANY($1::int[]) OR product_id = ANY($2::int[])', [orderIds, productIds], 'order item relation');
	await relation('reviews', 'reviews', 'SELECT id, product_id, store_id, customer_id, order_id FROM reviews WHERE product_id = ANY($1::int[]) OR store_id = ANY($2::int[]) OR customer_id = ANY($3::int[]) OR order_id = ANY($4::int[])', [productIds, storeIds, userIds, orderIds], 'review relation');
	await relation('store_followers', 'store_followers', 'SELECT id, store_id, user_id FROM store_followers WHERE store_id = ANY($1::int[]) OR user_id = ANY($2::int[])', [storeIds, userIds], 'store follower relation');
	await relation('wishlist', 'wishlist', 'SELECT id, user_id, product_id FROM wishlist WHERE user_id = ANY($1::int[]) OR product_id = ANY($2::int[])', [userIds, productIds], 'wishlist relation');
	await relation('cart_items', 'cart_items', 'SELECT id, user_id, product_id FROM cart_items WHERE user_id = ANY($1::int[]) OR product_id = ANY($2::int[])', [userIds, productIds], 'cart relation');
	await relation('messages', 'messages', 'SELECT id, sender_id, receiver_id, store_id FROM messages WHERE sender_id = ANY($1::int[]) OR receiver_id = ANY($1::int[]) OR store_id = ANY($2::int[])', [userIds, storeIds], 'message relation');
	await relation('notifications', 'notifications', 'SELECT id, user_id, type FROM notifications WHERE user_id = ANY($1::int[])', [userIds], 'notification relation');
	await relation('disputes', 'disputes', 'SELECT id, order_id, customer_id, store_id, status FROM disputes WHERE order_id = ANY($1::int[]) OR customer_id = ANY($2::int[]) OR store_id = ANY($3::int[])', [orderIds, userIds, storeIds], 'dispute relation');
	await relation('coupon_usage', 'coupon_usage', 'SELECT id, coupon_id, user_id, order_id FROM coupon_usage WHERE coupon_id = ANY($1::int[]) OR user_id = ANY($2::int[]) OR order_id = ANY($3::int[])', [couponIds, userIds, orderIds], 'coupon usage relation');
	await relation('subscriptions', 'subscriptions', 'SELECT id, store_id, status FROM subscriptions WHERE store_id = ANY($1::int[])', [storeIds], 'subscription relation');
	// entity_id is TEXT but we send only digits; cast to ::text on the column
	await relation('admin_audit_log', 'admin_audit_log', 'SELECT id, user_id, action, entity_type, entity_id FROM admin_audit_log WHERE user_id = ANY($1::int[]) OR entity_id = ANY($2::text[])', [userIds, targetStoreIds.concat(targetProductIds, targetOrderIds).map(String)], 'audit log relation', true);
	await relation('store_balance', 'store_balance', 'SELECT id, store_id, available, pending, currency FROM store_balance WHERE store_id = ANY($1::int[])', [storeIds], 'store balance relation', true);
	await relation('payments', 'payments', 'SELECT id, order_id, user_id, status, amount, currency, provider_txn_id FROM payments WHERE order_id = ANY($1::int[]) OR user_id = ANY($2::int[])', [orderIds, userIds], 'payment relation', true);
	await relation('refunds', 'refunds', 'SELECT id, order_id, payment_id, user_id, status, amount FROM refunds WHERE order_id = ANY($1::int[]) OR user_id = ANY($2::int[])', [orderIds, userIds], 'refund relation', true);
	await relation('transactions', 'transactions', 'SELECT id, store_id, reference_type, reference_id, amount, currency FROM transactions WHERE store_id = ANY($1::int[]) OR reference_id = ANY($2::int[])', [storeIds, targetOrderIds], 'financial ledger relation', true);
	await relation('shipments', 'shipments', 'SELECT * FROM shipments WHERE order_id = ANY($1::int[])', [orderIds], 'shipment relation', true);
	await relation('invoices', 'invoices', 'SELECT * FROM invoices WHERE order_id = ANY($1::int[])', [orderIds], 'invoice relation', true);
	await relation('delivery_agent_assignments', 'delivery_agent_assignments', 'SELECT * FROM delivery_agent_assignments WHERE order_id = ANY($1::int[]) OR agent_id IN (SELECT id FROM delivery_agents WHERE user_id = ANY($2::int[]))', [orderIds, userIds], 'delivery assignment relation', true);

	for (const item of unexpectedRelations) blockers.push({ reason: item.type, rows: [item.row] });

	const report = {
		environment: process.env.NODE_ENV || null,
		available_tables: available,
		target,
		relations,
		unexpected_relations: unexpectedRelations,
		blockers,
	};
	report.fingerprint = crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
	return report;
}

function redactReport(report) {
	return report;
}

async function main() {
	const client = new Client({ connectionString: resolveDatabaseUrl() });
	await client.connect();
	try {
		await client.query('BEGIN READ ONLY');
		const report = redactReport(await collectReport(client));
		await client.query('COMMIT');
		console.log(JSON.stringify(report, null, 2));
	} catch (error) {
		await client.query('ROLLBACK').catch(() => undefined);
		throw error;
	} finally {
		await client.end();
	}
}

if (require.main === module) {
	main().catch((error) => {
		console.error(`[audit-demo-data] FAILED: ${error.message}`);
		process.exitCode = 1;
	});
}

module.exports = { collectReport, resolveDatabaseUrl };
