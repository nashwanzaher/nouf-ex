/**
 * Cache invalidation helpers (Phase 1).
 *
 * Centralised so route mutations don't have to remember which keys to
 * bust. Each helper is idempotent and fail-OPEN (Redis errors are
 * logged and swallowed; the DB write is still authoritative).
 */
import { cacheBust, cacheDel } from './cache.ts';
import { log } from './shared.ts';

const TAG_PREFIX = 'catalog:';

async function safeBust(prefix: string): Promise<void> {
	try {
		await cacheBust(`${TAG_PREFIX}${prefix}`);
	} catch (err) {
		log.warn({
			msg: 'cache_invalidation_failed',
			prefix,
			error: (err as Error).message,
		});
	}
}

async function safeDel(...keys: string[]): Promise<void> {
	try {
		await cacheDel(...keys);
	} catch (err) {
		log.warn({
			msg: 'cache_invalidation_failed',
			keys,
			error: (err as Error).message,
		});
	}
}

export async function invalidateProduct(productId: number): Promise<void> {
	await Promise.all([
		safeDel(
			`${TAG_PREFIX}product:${productId}:v1`,
			`${TAG_PREFIX}product:${productId}:images:v1`,
		),
		safeBust('featured:'),
		safeBust('deals:'),
	]);
}

export async function invalidateStore(storeId: number): Promise<void> {
	await safeDel(`${TAG_PREFIX}store:${storeId}:v1`);
}

export async function invalidateCategories(): Promise<void> {
	await safeDel(`${TAG_PREFIX}categories:tree:v1`);
}

export async function invalidateStats(): Promise<void> {
	await safeDel('stats:home:v1');
}

export const invalidate = {
	product: invalidateProduct,
	store: invalidateStore,
	categories: invalidateCategories,
	stats: invalidateStats,
};