'use strict';

const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { collectReport, resolveDatabaseUrl } = require('./audit-demo-data.cjs');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

function parseArgs(argv) {
	const args = { apply: false, rollback: false, confirm: '' };
	for (let i = 2; i < argv.length; i += 1) {
		const value = argv[i];
		if (value === '--dry-run') args.apply = false;
		else if (value === '--apply') args.apply = true;
		else if (value === '--rollback') args.rollback = true;
		else if (value.startsWith('--confirm=')) args.confirm = value.slice('--confirm='.length);
		else if (value === '--confirm') args.confirm = argv[++i] || '';
		else if (value === '--help') {
			console.log('Usage: node scripts/db/cleanup-demo-data.cjs --dry-run');
			console.log('       node scripts/db/cleanup-demo-data.cjs --apply --confirm=<dry-run-fingerprint>');
			console.log('       node scripts/db/cleanup-demo-data.cjs --apply --rollback --confirm=<dry-run-fingerprint>');
			process.exit(0);
		} else {
			throw new Error(`Unknown argument: ${value}`);
		}
	}
	if (args.rollback && !args.apply) throw new Error('--rollback requires --apply');
	return args;
}

function assertSafeEnvironment() {
	const environment = process.env.NODE_ENV;
	if (!['development', 'test', 'staging'].includes(environment)) {
		throw new Error('cleanup requires NODE_ENV=development, test, or staging');
	}
	const url = resolveDatabaseUrl();
	if (/(^|[._-])(prod|production)([._/-]|$)/i.test(url)) {
		throw new Error('cleanup target looks like a production database');
	}
}

function ids(report, key) {
	return report.target[key].map((row) => row.id).filter((id) => Number.isInteger(id));
}

async function deleteByIds(client, table, column, values) {
	if (!values.length) return;
	await client.query(`DELETE FROM ${table} WHERE ${column} = ANY($1::int[])`, [values]);
}

async function deleteCleanupGraph(client, report) {
	const userIds = ids(report, 'users');
	const storeIds = ids(report, 'stores');
	const productIds = ids(report, 'products');
	const orderIds = ids(report, 'orders');
	const couponIds = ids(report, 'coupons');
	const available = report.available_tables;

	if (available.delivery_agent_assignments) {
		await client.query(
			'DELETE FROM delivery_agent_assignments WHERE order_id = ANY($1::int[]) OR agent_id IN (SELECT id FROM delivery_agents WHERE user_id = ANY($2::int[]))',
			[orderIds, userIds],
		);
	}
	if (available.notifications) await deleteByIds(client, 'notifications', 'user_id', userIds);
	if (available.messages) {
		await client.query('DELETE FROM messages WHERE sender_id = ANY($1::int[]) OR receiver_id = ANY($1::int[]) OR store_id = ANY($2::int[])', [userIds, storeIds]);
	}
	if (available.store_followers) {
		await client.query('DELETE FROM store_followers WHERE store_id = ANY($1::int[]) OR user_id = ANY($2::int[])', [storeIds, userIds]);
	}
	if (available.wishlist) {
		await client.query('DELETE FROM wishlist WHERE user_id = ANY($1::int[]) OR product_id = ANY($2::int[])', [userIds, productIds]);
	}
	if (available.cart_items) {
		await client.query('DELETE FROM cart_items WHERE user_id = ANY($1::int[]) OR product_id = ANY($2::int[])', [userIds, productIds]);
	}
	if (available.disputes) await deleteByIds(client, 'disputes', 'order_id', orderIds);
	if (available.reviews) {
		await client.query('DELETE FROM reviews WHERE product_id = ANY($1::int[]) OR store_id = ANY($2::int[]) OR customer_id = ANY($3::int[]) OR order_id = ANY($4::int[])', [productIds, storeIds, userIds, orderIds]);
	}
	if (available.coupon_usage) {
		await client.query('DELETE FROM coupon_usage WHERE coupon_id = ANY($1::int[]) OR user_id = ANY($2::int[]) OR order_id = ANY($3::int[])', [couponIds, userIds, orderIds]);
	}
	if (available.order_items) await deleteByIds(client, 'order_items', 'order_id', orderIds);
	if (available.product_images) await deleteByIds(client, 'product_images', 'product_id', productIds);
	if (available.product_variants) await deleteByIds(client, 'product_variants', 'product_id', productIds);
	if (available.addresses) await deleteByIds(client, 'addresses', 'user_id', userIds);
	if (available.delivery_agents) await deleteByIds(client, 'delivery_agents', 'user_id', userIds);
	if (available.orders) await deleteByIds(client, 'orders', 'id', orderIds);
	if (available.coupons) await deleteByIds(client, 'coupons', 'id', couponIds);
	if (available.products) await deleteByIds(client, 'products', 'id', productIds);
	if (available.subscriptions) await deleteByIds(client, 'subscriptions', 'store_id', storeIds);
	if (available.stores) await deleteByIds(client, 'stores', 'id', storeIds);
	if (available.users) await deleteByIds(client, 'users', 'id', userIds);
}

function totalRows(report) {
	const target = Object.values(report.target).reduce((sum, value) => sum + value.length, 0);
	const relations = Object.values(report.relations).reduce((sum, value) => sum + value.length, 0);
	return target + relations + report.unexpected_relations.length;
}

async function main() {
	const args = parseArgs(process.argv);
	if (args.apply) assertSafeEnvironment();

	const client = new Client({ connectionString: resolveDatabaseUrl() });
	await client.connect();
	try {
		const before = await collectReport(client);
		console.log(JSON.stringify({ phase: 'before', report: before }, null, 2));
		if (!args.apply) return;
		if (!args.confirm || args.confirm !== before.fingerprint) {
			throw new Error('cleanup requires --confirm equal to the current dry-run fingerprint');
		}
		if (before.blockers.length > 0) {
			throw new Error(`cleanup stopped: ${before.blockers.length} blocker(s) require review`);
		}

		await client.query('BEGIN');
		try {
			await deleteCleanupGraph(client, before);
			const after = await collectReport(client);
			console.log(JSON.stringify({ phase: 'after', report: after }, null, 2));
			if (totalRows(after) !== 0) {
				throw new Error('cleanup stopped: target graph is not empty after deletion');
			}
			if (args.rollback) {
				await client.query('ROLLBACK');
				console.log(JSON.stringify({ committed: false, rolled_back: true }, null, 2));
			} else {
				await client.query('COMMIT');
				console.log(JSON.stringify({ committed: true, rolled_back: false }, null, 2));
			}
		} catch (error) {
			await client.query('ROLLBACK').catch(() => undefined);
			throw error;
		}
	} finally {
		await client.end();
	}
}

if (require.main === module) {
	main().catch((error) => {
		console.error(`[cleanup-demo-data] STOPPED: ${error.message}`);
		process.exitCode = 1;
	});
}

module.exports = { deleteCleanupGraph, parseArgs, totalRows };
