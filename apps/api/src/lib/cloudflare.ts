/**
 * Cloudflare cache-purge integration (Phase 4).
 *
 * When the API writes to a mutating endpoint (product PATCH, etc.)
 * we invalidate the Redis cache AND optionally purge the matching
 * Cloudflare edge cache so users in Dubai/Muscat see the change
 * within ~5 seconds instead of waiting for the TTL.
 *
 * Failure mode: fail-OPEN. If CLOUDFLARE_API_TOKEN is not set or
 * the API call rejects, we log a warning and continue. The CDN
 * will expire stale entries on its own TTL.
 *
 * Reference:
 *   POST https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache
 *   Authorization: Bearer {api_token}
 */
import { log } from './shared.ts';

const PURGE_URL = (zoneId: string) =>
	`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;

interface PurgeResult {
	ok: boolean;
	purged: number;
	error?: string;
}

export function isCloudflarePurgeEnabled(): boolean {
	return Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID);
}

/** Purge cache by tag (Cache-Tag header must be set on responses for
 *  this to work — see middleware Cache-Tag annotation). */
export async function purgeTags(tags: string[]): Promise<PurgeResult> {
	if (!isCloudflarePurgeEnabled() || tags.length === 0) {
		return { ok: false, purged: 0, error: 'cloudflare_purge_disabled' };
	}
	const token = process.env.CLOUDFLARE_API_TOKEN!;
	const zone = process.env.CLOUDFLARE_ZONE_ID!;
	try {
		const res = await fetch(PURGE_URL(zone), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ tags }),
		});
		const json = (await res.json()) as {
			success: boolean;
			result?: { id: string };
			errors?: Array<{ message: string }>;
		};
		if (!json.success) {
			const err = json.errors?.[0]?.message ?? 'unknown';
			log.warn({ msg: 'cloudflare_purge_failed', tags, error: err });
			return { ok: false, purged: 0, error: err };
		}
		log.info({ msg: 'cloudflare_purge_ok', tags });
		return { ok: true, purged: tags.length };
	} catch (err) {
		log.warn({
			msg: 'cloudflare_purge_error',
			tags,
			error: (err as Error).message,
		});
		return { ok: false, purged: 0, error: (err as Error).message };
	}
}

/** Purge everything in the zone. Use sparingly — prefer tag-based
 *  purges from route handlers. */
export async function purgeAll(): Promise<PurgeResult> {
	if (!isCloudflarePurgeEnabled()) {
		return { ok: false, purged: 0, error: 'cloudflare_purge_disabled' };
	}
	const token = process.env.CLOUDFLARE_API_TOKEN!;
	const zone = process.env.CLOUDFLARE_ZONE_ID!;
	try {
		const res = await fetch(PURGE_URL(zone), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ purge_everything: true }),
		});
		const json = (await res.json()) as {
			success: boolean;
			errors?: Array<{ message: string }>;
		};
		if (!json.success) {
			return { ok: false, purged: 0, error: json.errors?.[0]?.message };
		}
		return { ok: true, purged: -1 };
	} catch (err) {
		return { ok: false, purged: 0, error: (err as Error).message };
	}
}

/** Convenience: invalidate product-related tags. */
export function productTags(productId: number): string[] {
	return [`product-${productId}`, 'catalog'];
}

export function storeTags(storeId: number): string[] {
	return [`store-${storeId}`, 'catalog'];
}

export function categoryTags(): string[] {
	return ['catalog', 'categories'];
}