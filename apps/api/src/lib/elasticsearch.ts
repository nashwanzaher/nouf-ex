/**
 * Elasticsearch client wrapper (Phase 3, competitive-architecture-analysis).
 *
 * Lazy-init, fail-OPEN client. If ELASTICSEARCH_URL is unset or the
 * cluster is unreachable, every helper returns a typed "unavailable"
 * response and the route handlers transparently fall back to the
 * PostgreSQL FTS path (lib/search.ts).
 *
 * Multi-language analyzers:
 *   - Arabic  (built-in `arabic` analyzer + light stemming)
 *   - English (built-in `english` analyzer + porter stemmer)
 *   - Chinese (per-field icu_normalizer + cjk_bigram token filter)
 *
 * The mapping below ships with a `_doc` document shape that mirrors
 * the catalog response (so the API can return ES results directly).
 */
import { Client } from '@elastic/elasticsearch';
import { log } from './shared.ts';

let _client: Client | null = null;
let _disabled = false;
const INDEX_PREFIX = () => process.env.ELASTICSEARCH_INDEX_PREFIX || 'noufex';

export function isSearchV2Enabled(): boolean {
	return Boolean(process.env.ELASTICSEARCH_URL?.trim()) && !_disabled;
}

export function getEs(): Client | null {
	if (_disabled) return null;
	if (_client) return _client;
	const url = process.env.ELASTICSEARCH_URL?.trim();
	if (!url) return null;
	try {
		_client = new Client({
			node: url,
			requestTimeout: 5_000,
			maxRetries: 2,
		});
		_client
			.ping()
			.then(() => log.info({ msg: 'elasticsearch_ready' }))
			.catch((err: Error) => {
				log.warn({ msg: 'elasticsearch_ping_failed', error: err.message });
				_disabled = true;
			});
		return _client;
	} catch (err) {
		log.warn({
			msg: 'elasticsearch_init_failed',
			error: (err as Error).message,
		});
		_disabled = true;
		return null;
	}
}

export function productIndex(): string {
	return `${INDEX_PREFIX()}_products_v1`;
}

export function storeIndex(): string {
	return `${INDEX_PREFIX()}_stores_v1`;
}

export function categoryIndex(): string {
	return `${INDEX_PREFIX()}_categories_v1`;
}

/**
 * Tier 3.3: shared index settings — includes the Arabic synonym
 * filter (`synonyms_ar`) that maps regional/dialect terms to a
 * canonical stem so a search for "جوال" finds "هاتف" too.
 *
 * Uses the `synonym_graph` token filter (Solr-style bidirectional
 * expansion) so multi-word phrases like "ريال سعودي" still work.
 * The synonym file is bundled at `cloudflare/elasticsearch/synonyms_ar.txt`
 * and must be copied into the API container at
 * `/usr/share/noufex/elasticsearch/synonyms_ar.txt` (or wherever
 * `ES_SYNONYMS_PATH` points).
 */
const ARABIC_SYNONYMS_PATH = process.env.ES_SYNONYMS_PATH ?? 'cloudflare/elasticsearch/synonyms_ar.txt';

const SHARED_INDEX_SETTINGS = {
	analysis: {
		filter: {
			// Arabic light stemming (built-in) + Yemeni/GCC synonym graph.
			synonyms_ar: {
				type: 'synonym_graph' as const,
				synonyms_path: ARABIC_SYNONYMS_PATH,
				updateable: true,
				lenient: true,
			},
			// Strip diacritics (tashkil) before stemming so users
			// searching without diacritics still match indexed content.
			arabic_normalizer: {
				type: 'arabic_normalization' as const,
			},
			// Apply the built-in Arabic analyzer + synonyms.
			arabic_stop: {
				type: 'stop' as const,
				stopwords: '_arabic_' as const,
			},
			arabic_stemmer: {
				type: 'stemmer' as const,
				language: 'arabic',
			},
		},
		analyzer: {
			// Analyzer used at INDEX + SEARCH time on Arabic fields.
			// Runs in this order: normalize → synonym expand → tokenize →
			// stop-word removal → stem → lowercase.
			arabic_index_analyzer: {
				type: 'custom' as const,
				tokenizer: 'standard',
				filter: [
					'lowercase',
					'arabic_normalizer',
					'decimal_digit',
					'synonyms_ar',
					'arabic_normalizer',
					'arabic_stop',
					'arabic_stemmer',
				],
			},
			arabic_search_analyzer: {
				type: 'custom' as const,
				tokenizer: 'standard',
				filter: [
					'lowercase',
					'arabic_normalizer',
					'decimal_digit',
					'synonyms_ar',
					'arabic_normalizer',
					'arabic_stop',
					'arabic_stemmer',
				],
			},
		},
	},
};

/** Idempotent index creation. Called by the bootstrap and reindex
 *  script. Re-running with a new shape requires an explicit reindex
 *  (we never modify a live mapping in place). */
export async function ensureIndices(): Promise<{ created: boolean; skipped: string[] }> {
	const c = getEs();
	if (!c) return { created: false, skipped: [] };
	const skipped: string[] = [];
	for (const [name, mapping] of [
		[productIndex(), PRODUCT_MAPPING],
		[storeIndex(), STORE_MAPPING],
		[categoryIndex(), CATEGORY_MAPPING],
	] as const) {
		const exists = await c.indices.exists({ index: name });
		if (exists) {
			skipped.push(name);
			continue;
		}
		await c.indices.create({
			index: name,
			settings: SHARED_INDEX_SETTINGS,
			mappings: mapping,
		});
	}
	return { created: true, skipped };
}

const PRODUCT_MAPPING = {
	properties: {
		id: { type: 'long' },
		store_id: { type: 'long' },
		store_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
		category_id: { type: 'long' },
		name_ar: {
			type: 'text',
			analyzer: 'arabic_index_analyzer',
			search_analyzer: 'arabic_search_analyzer',
			fields: { keyword: { type: 'keyword' } },
		},
		name_en: {
			type: 'text',
			analyzer: 'english',
			fields: { keyword: { type: 'keyword' } },
		},
		name_zh: {
			type: 'text',
			analyzer: 'standard',
			fields: { keyword: { type: 'keyword' } },
		},
		description_ar: {
			type: 'text',
			analyzer: 'arabic_index_analyzer',
			search_analyzer: 'arabic_search_analyzer',
		},
		description_en: { type: 'text', analyzer: 'english' },
		description_zh: { type: 'text', analyzer: 'standard' },
		price: { type: 'double' },
		original_price: { type: 'double' },
		currency: { type: 'keyword' },
		stock: { type: 'integer' },
		rating: { type: 'float' },
		review_count: { type: 'integer' },
		sold_count: { type: 'integer' },
		is_active: { type: 'boolean' },
		is_featured: { type: 'boolean' },
		has_deal: { type: 'boolean' },
		deal_discount: { type: 'float' },
		main_image: { type: 'keyword', index: false },
		tags: { type: 'keyword' },
		features: { type: 'text' },
		badges: { type: 'keyword' },
		created_at: { type: 'date' },
		updated_at: { type: 'date' },
		suggest: {
			type: 'completion',
			analyzer: 'simple',
			preserve_separators: true,
		},
	},
} as const;

const STORE_MAPPING = {
	properties: {
		id: { type: 'long' },
		owner_id: { type: 'long' },
		store_name_ar: {
			type: 'text',
			analyzer: 'arabic_index_analyzer',
			search_analyzer: 'arabic_search_analyzer',
		},
		store_name_en: { type: 'text', analyzer: 'english' },
		store_name_zh: { type: 'text', analyzer: 'standard' },
		slug: { type: 'keyword' },
		logo: { type: 'keyword', index: false },
		banner: { type: 'keyword', index: false },
		description: { type: 'text', analyzer: 'english' },
		location: { type: 'text', fields: { keyword: { type: 'keyword' } } },
		governorate: { type: 'keyword' },
		geo: { type: 'geo_point' },
		trust_level: { type: 'keyword' },
		rating: { type: 'float' },
		review_count: { type: 'integer' },
		is_active: { type: 'boolean' },
		is_verified: { type: 'boolean' },
		suggest: {
			type: 'completion',
			analyzer: 'simple',
		},
	},
} as const;

const CATEGORY_MAPPING = {
	properties: {
		id: { type: 'long' },
		parent_id: { type: 'long' },
		slug: { type: 'keyword' },
		name_ar: {
			type: 'text',
			analyzer: 'arabic_index_analyzer',
			search_analyzer: 'arabic_search_analyzer',
		},
		name_en: { type: 'text', analyzer: 'english' },
		name_zh: { type: 'text', analyzer: 'standard' },
		sort_order: { type: 'integer' },
		is_active: { type: 'boolean' },
		product_count: { type: 'integer' },
	},
} as const;

export async function closeEs(): Promise<void> {
	if (!_client) return;
	try {
		await _client.close();
	} catch {
		// ignore
	}
	_client = null;
}