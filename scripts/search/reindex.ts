#!/usr/bin/env node
/**
 * search:reindex — bulk backfill Elasticsearch from PostgreSQL.
 *
 * Why this exists
 *   ES starts empty on every fresh deploy. Without a bootstrap
 *   step the /api/search endpoint reports `source: 'unavailable'`
 *   until enough product PATCHes trickle through the RabbitMQ
 *   stream. This script does a one-shot backfill from the
 *   canonical PG tables.
 *
 * Usage
 *   node --experimental-strip-types scripts/search/reindex.ts
 *   node --experimental-strip-types scripts/search/reindex.ts --only=products
 *   node --experimental-strip-types scripts/search/reindex.ts --batch=500
 *
 *   Env vars (or .env):
 *     DATABASE_URL             PostgreSQL connection string
 *     ELASTICSEARCH_URL        ES cluster URL (required)
 *     ELASTICSEARCH_INDEX_PREFIX   default 'noufex'
 *     REDIS_URL                Optional — flushed at the end so the
 *                              catalog cache reflects the new state.
 *
 * Behaviour
 *   1. Connects to PG via the same PgDb wrapper the API uses.
 *   2. Connects to ES, ensures the 3 indices exist with the
 *      mappings in lib/elasticsearch.ts.
 *   3. Streams products, stores, categories in batches of `--batch`
 *      and bulk-indexes them. Refresh forced between batches.
 *   4. Logs a summary at the end.
 *   5. Optionally busts the Redis catalog cache.
 *
 * Exit codes
 *   0 — success
 *   1 — missing DATABASE_URL or ELASTICSEARCH_URL
 *   2 — PG connection failed
 *   3 — ES cluster unreachable
 *   4 — bulk index reported failures
 */

import { config as loadDotenv } from 'dotenv';
loadDotenv();

const argv = process.argv.slice(2);
const args = new Map<string, string>();
for (let i = 0; i < argv.length; i += 1) {
	const a = argv[i];
	if (a.startsWith('--')) {
		const k = a.slice(2);
		const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
		args.set(k, v);
		i += v === 'true' ? 0 : 1;
	}
}

const ONLY = args.get('only');
const BATCH = Number.parseInt(args.get('batch') ?? '500', 10);
const SKIP_REDIS = args.has('no-redis-flush');

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const ES_URL_RAW = process.env.ELASTICSEARCH_URL;
const ES_PREFIX = process.env.ELASTICSEARCH_INDEX_PREFIX || 'noufex';

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL is not set');
	process.exit(1);
}
if (!ES_URL_RAW) {
	console.error('❌ ELASTICSEARCH_URL is not set');
	process.exit(1);
}
const ES_URL: string = ES_URL_RAW;

interface PgRow {
	[k: string]: unknown;
}

async function main() {
	const start = Date.now();
	console.log(`▶ reindex starting (only=${ONLY ?? 'all'}, batch=${BATCH})`);
	console.log(`  ES URL: ${ES_URL.replace(/\/\/[^@]+@/, '//***@')}`);
	console.log(`  ES prefix: ${ES_PREFIX}`);

	// ── PG ────────────────────────────────────────────────────────────
	const { PgDb } = await import('../../../apps/api/src/db/pg-wrapper.ts');
	const db = new PgDb(DATABASE_URL);
	try {
		await db.prepare('SELECT 1').get();
		console.log('✓ PostgreSQL connection OK');
	} catch (err) {
		console.error('❌ PostgreSQL connection failed:', (err as Error).message);
		process.exit(2);
	}

	// ── ES ────────────────────────────────────────────────────────────
	const { Client } = await import('@elastic/elasticsearch');
	const es = new Client({ node: ES_URL, requestTimeout: 10_000 });
	try {
		await es.ping();
		console.log('✓ Elasticsearch connection OK');
	} catch (err) {
		console.error('❌ Elasticsearch unreachable:', (err as Error).message);
		process.exit(3);
	}

	const PRODUCT_INDEX = `${ES_PREFIX}_products_v1`;
	const STORE_INDEX = `${ES_PREFIX}_stores_v1`;
	const CATEGORY_INDEX = `${ES_PREFIX}_categories_v1`;
	const CAT_IDX = CATEGORY_INDEX;

	// We mirror the mappings here (avoiding a cross-package import for
	// a one-shot CLI). Keep in sync with apps/api/src/lib/elasticsearch.ts.
	const productMapping: Record<string, unknown> = {
		properties: {
			id: { type: 'long' },
			store_id: { type: 'long' },
			store_name: { type: 'text' },
			category_id: { type: 'long' },
			name_ar: { type: 'text', analyzer: 'arabic' },
			name_en: { type: 'text', analyzer: 'english' },
			name_zh: { type: 'text', analyzer: 'standard' },
			price: { type: 'double' },
			currency: { type: 'keyword' },
			stock: { type: 'integer' },
			rating: { type: 'float' },
			review_count: { type: 'integer' },
			sold_count: { type: 'integer' },
			is_active: { type: 'boolean' },
			is_featured: { type: 'boolean' },
			has_deal: { type: 'boolean' },
			main_image: { type: 'keyword', index: false },
			suggest: { type: 'completion', analyzer: 'simple' },
		},
	};
	const storeMapping: Record<string, unknown> = {
		properties: {
			id: { type: 'long' },
			owner_id: { type: 'long' },
			store_name_ar: { type: 'text', analyzer: 'arabic' },
			store_name_en: { type: 'text', analyzer: 'english' },
			store_name_zh: { type: 'text', analyzer: 'standard' },
			slug: { type: 'keyword' },
			is_active: { type: 'boolean' },
			trust_level: { type: 'keyword' },
			rating: { type: 'float' },
			suggest: { type: 'completion' },
		},
	};
	const categoryMapping: Record<string, unknown> = {
		properties: {
			id: { type: 'long' },
			slug: { type: 'keyword' },
			name_ar: { type: 'text', analyzer: 'arabic' },
			name_en: { type: 'text', analyzer: 'english' },
			name_zh: { type: 'text', analyzer: 'standard' },
			is_active: { type: 'boolean' },
		},
	};

	// Ensure indices exist (idempotent).
	const ensureIndices = async () => {
		for (const [name, mapping] of [
			[PRODUCT_INDEX, productMapping],
			[STORE_INDEX, storeMapping],
			[CATEGORY_INDEX, categoryMapping],
		] as const) {
			const exists = await es.indices.exists({ index: name });
			if (exists) {
				console.log(`  · index ${name} exists`);
			} else {
				await es.indices.create({ index: name, mappings: mapping });
				console.log(`  + created index ${name}`);
			}
		}
	};

	await ensureIndices();

	let totalIndexed = 0;
	let totalFailed = 0;

	async function bulkIndex<T extends PgRow>(
		indexName: string,
		rows: T[],
		toDoc: (row: T) => Record<string, unknown>,
	) {
		if (rows.length === 0) return;
		const ops = rows.flatMap((r) => [
			{ index: { _index: indexName, _id: String(r.id) } },
			toDoc(r),
		]);
		const res = await es.bulk({ refresh: false, operations: ops });
		if (res.errors) {
			const failedItems = res.items.filter((it) => it.index?.error);
			totalFailed += failedItems.length;
			console.error(`  ✗ ${failedItems.length} bulk items failed in ${indexName}`);
			for (const f of failedItems.slice(0, 3)) {
				console.error('    ', JSON.stringify(f.index?.error));
			}
		}
		totalIndexed += rows.length - totalFailed;
		await es.indices.refresh({ index: indexName });
	}

	// ── PRODUCTS ──────────────────────────────────────────────────────
	if (!ONLY || ONLY === 'products') {
		console.log('▶ indexing products');
		const products = (await db
			.prepare(
				`SELECT p.id, p.store_id, s.store_name, p.category_id,
				        p.name_ar, p.name_en, p.name_zh, p.description,
				        p.description_en, p.description_zh, p.price,
				        p.original_price, p.currency, p.stock, p.rating,
				        p.review_count, p.sold_count, p.is_active,
				        p.is_featured, p.deal_discount, p.main_image,
				        p.features, p.badges
				   FROM products p
				   JOIN stores s ON s.id = p.store_id
				  WHERE p.deleted_at IS NULL`,
			)
			.all()) as PgRow[];

		for (let i = 0; i < products.length; i += BATCH) {
			const slice = products.slice(i, i + BATCH);
			await bulkIndex(PRODUCT_INDEX, slice, (row) => ({
				id: row.id,
				store_id: row.store_id,
				store_name: row.store_name,
				category_id: row.category_id,
				name_ar: row.name_ar,
				name_en: row.name_en,
				name_zh: row.name_zh,
				description_ar: row.description,
				description_en: row.description_en,
				description_zh: row.description_zh,
				price: Number(row.price),
				original_price: row.original_price != null ? Number(row.original_price) : null,
				currency: row.currency,
				stock: row.stock,
				rating: Number(row.rating ?? 0),
				review_count: row.review_count,
				sold_count: row.sold_count,
				is_active: row.is_active === true || row.is_active === 1,
				is_featured: row.is_featured === true || row.is_featured === 1,
				has_deal: Number(row.deal_discount ?? 0) > 0,
				deal_discount: Number(row.deal_discount ?? 0),
				main_image: row.main_image,
				suggest: {
					input: [row.name_ar, row.name_en, row.name_zh].filter(Boolean) as string[],
				},
			}));
			console.log(`  · products ${i + slice.length}/${products.length}`);
		}
		console.log(`✓ products: ${products.length}`);
	}

	// ── STORES ────────────────────────────────────────────────────────
	if (!ONLY || ONLY === 'stores') {
		console.log('▶ indexing stores');
		const stores = (await db
			.prepare('SELECT * FROM stores WHERE deleted_at IS NULL')
			.all()) as PgRow[];
		for (let i = 0; i < stores.length; i += BATCH) {
			const slice = stores.slice(i, i + BATCH);
			await bulkIndex(STORE_INDEX, slice, (row) => ({
				id: row.id,
				owner_id: row.owner_id,
				store_name_ar: row.store_name,
				store_name_en: row.store_name_en,
				store_name_zh: row.store_name_zh,
				slug: row.slug,
				is_active: row.is_active === true || row.is_active === 1,
				trust_level: row.trust_level,
				rating: Number(row.rating ?? 0),
				suggest: {
					input: [row.store_name, row.store_name_en, row.store_name_zh].filter(
						Boolean,
					) as string[],
				},
			}));
			console.log(`  · stores ${i + slice.length}/${stores.length}`);
		}
		console.log(`✓ stores: ${stores.length}`);
	}

	// ── CATEGORIES ────────────────────────────────────────────────────
	if (!ONLY || ONLY === 'categories') {
		console.log('▶ indexing categories');
		const cats = (await db
			.prepare('SELECT * FROM categories WHERE is_active = 1')
			.all()) as PgRow[];
		await bulkIndex(CATEGORY_INDEX, cats, (row) => ({
			id: row.id,
			parent_id: row.parent_id,
			slug: row.slug,
			name_ar: row.name_ar,
			name_en: row.name_en,
			name_zh: row.name_zh,
			is_active: true,
		}));
		console.log(`✓ categories: ${cats.length}`);
	}

	// ── Redis cache flush (optional) ─────────────────────────────────
	if (!SKIP_REDIS && process.env.REDIS_URL) {
		console.log('▶ flushing Redis catalog cache');
		try {
			const IORedis = (await import('ioredis')).default;
			const r = new IORedis(process.env.REDIS_URL, {
				keyPrefix: process.env.REDIS_KEY_PREFIX || 'noufex:',
				maxRetriesPerRequest: 2,
			});
			const stream = r.scanStream({ match: 'catalog:*', count: 200 });
			let removed = 0;
			for await (const keys of stream) {
				if (keys.length > 0) {
					removed += await r.del(...keys);
				}
			}
			await r.quit().catch(() => void 0);
			console.log(`✓ Redis cache: removed ${removed} keys`);
		} catch (err) {
			console.warn(`⚠ Redis flush failed: ${(err as Error).message}`);
		}
	}

	const took = Date.now() - start;
	console.log('');
	console.log(`✅ reindex complete in ${took}ms`);
	console.log(`   indexed: ${totalIndexed}, failed: ${totalFailed}`);
	if (totalFailed > 0) process.exit(4);
	process.exit(0);
}

main().catch((err) => {
	console.error('❌ unexpected error:', err);
	process.exit(1);
});