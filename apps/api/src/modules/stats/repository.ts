import { db } from '../../lib/shared.ts';

export async function countProducts(): Promise<number> {
	const r = (await db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = TRUE').get()) as
		| { count?: number }
		| undefined;
	return r?.count ?? 0;
}

export async function countStores(): Promise<number> {
	const r = (await db.prepare('SELECT COUNT(*) as count FROM stores WHERE is_active = TRUE').get()) as
		| { count?: number }
		| undefined;
	return r?.count ?? 0;
}

export async function countOrders(): Promise<number> {
	const r = (await db
		.prepare("SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'")
		.get()) as { count?: number } | undefined;
	return r?.count ?? 0;
}

export async function countUsers(): Promise<number> {
	const r = (await db.prepare('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL').get()) as
		| { count?: number }
		| undefined;
	return r?.count ?? 0;
}

export async function featuredProducts() {
	return (await db
		.prepare(
			'SELECT * FROM products WHERE is_active = TRUE AND is_featured = TRUE ORDER BY created_at DESC LIMIT 6',
		)
		.all()) as Record<string, unknown>[];
}

export async function dealProducts() {
	return (await db
		.prepare(
			'SELECT * FROM products WHERE is_active = TRUE AND deal_discount > 0 ORDER BY deal_discount DESC LIMIT 6',
		)
		.all()) as Record<string, unknown>[];
}