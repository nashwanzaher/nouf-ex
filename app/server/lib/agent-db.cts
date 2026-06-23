/**
 * agent_db — typed query helper for the central knowledge base.
 *
 * The Nouf-ex backend talks to a SECOND PostgreSQL database
 * (`agent_db`, running in the `postgres_agent` container) for storing
 * information, experiences, skills, and reference material. This
 * module is the single import surface for the rest of the app —
 * nothing else should `import { Pool } from 'pg'` for the agent DB.
 *
 * Design notes:
 *   - Reuses the project's `PgDb` wrapper (the same one that fronts
 *     `noufex_db`) so the placeholder rewrite, transaction support,
 *     and JSONB parsing stay consistent across both databases.
 *   - Uses `AGENT_DATABASE_URL` (preferred) or the discrete
 *     `AGENT_DB_*` env vars. The runtime user is `agent_app`
 *     (least-privilege), so it can read/write knowledge tables but
 *     cannot edit `knowledge_entry_revisions` (the trigger does that).
 *   - All entry points fail OPEN on transient errors — a knowledge
 *     lookup that returns nothing must never block a customer-facing
 *     request. Callers always get either a real result or `null`.
 *   - Query results are typed (not `Record<string, unknown>`) so the
 *     consumer side has compile-time safety.
 */
import { z } from 'zod';
import { PgDb } from '../db/pg-wrapper.cts';
import { log } from '../middleware';

// =========================================================================
// 1. Env loading (mirrors the same Zod schema pattern as loadEnv() in
//    middleware.ts so the failure mode is consistent)
// =========================================================================
const agentEnvSchema = z.object({
	AGENT_DATABASE_URL: z.string().optional(),
	AGENT_DB_HOST: z.string().optional(),
	AGENT_DB_PORT: z.coerce.number().int().positive().default(5433),
	AGENT_DB_NAME: z.string().default('agent_db'),
	AGENT_DB_USER: z.string().default('agent_app'),
	AGENT_DB_PASSWORD: z.string().optional(),
});

function resolveAgentUrl(): string | null {
	const env = agentEnvSchema.safeParse(process.env);
	if (!env.success) {
		log.warn({ msg: 'agent_env_invalid', issues: env.error.issues });
		return null;
	}
	if (env.data.AGENT_DATABASE_URL) return env.data.AGENT_DATABASE_URL;
	if (env.data.AGENT_DB_HOST && env.data.AGENT_DB_USER && env.data.AGENT_DB_PASSWORD) {
		const { AGENT_DB_HOST, AGENT_DB_PORT, AGENT_DB_NAME, AGENT_DB_USER, AGENT_DB_PASSWORD } = env.data;
		return `postgresql://${AGENT_DB_USER}:${AGENT_DB_PASSWORD}@${AGENT_DB_HOST}:${AGENT_DB_PORT}/${AGENT_DB_NAME}`;
	}
	return null;
}

// =========================================================================
// 2. Typed result shapes (mirror the schema in agent_db/schema.sql)
// =========================================================================
export type KnowledgeKind = 'information' | 'experience' | 'skill' | 'reference';

export interface KnowledgeEntry {
	id: number;
	kind: KnowledgeKind;
	title_ar: string;
	title_en: string | null;
	body_ar: string | null;
	body_en: string | null;
	summary: string | null;
	slug: string | null;
	payload: Record<string, unknown>;
	source_lang: 'ar' | 'en' | 'zh';
	visibility: 'private' | 'team' | 'public';
	created_by: number;
	updated_by: number | null;
	created_at: string;
	updated_at: string;
}

export interface KnowledgeTag {
	id: number;
	slug: string;
	name_ar: string;
	name_en: string | null;
	color: string | null;
	usage_count: number;
}

export interface SearchHit {
	id: number;
	kind: KnowledgeKind;
	title_ar: string;
	title_en: string | null;
	summary: string | null;
	slug: string | null;
	ar_rank: number;
	en_rank: number;
}

// =========================================================================
// 3. The AgentDb class — single instance, lazy connection
// =========================================================================
export class AgentDb {
	private readonly db: PgDb;

	constructor(url: string) {
		this.db = new PgDb(url);
	}

	// ---- Search --------------------------------------------------------
	/**
	 * Bilingual FTS across the knowledge base. Uses two `tsquery`s
	 * (Arabic + English) and returns the top `limit` hits ranked by
	 * the higher of the two per-entry ranks.
	 *
	 * Returns `[]` on any failure — the knowledge base is a
	 * convenience, not a hard dependency.
	 */
	async searchKnowledge(
		query: string,
		opts: { kind?: KnowledgeKind; limit?: number } = {}
	): Promise<SearchHit[]> {
		const limit = Math.max(1, Math.min(50, opts.limit ?? 20));
		const kindFilter = opts.kind ? 'AND kind = $3' : '';
		const params: unknown[] = [query, limit];
		if (opts.kind) params.push(opts.kind);

		try {
			// Single round-trip: rank both languages, return the higher
			// rank as the effective rank. The `?` placeholders are
			// rewritten to $1, $2, ... by the PgDb wrapper.
			const rows = (await this.db
				.prepare(
					`SELECT id, kind, title_ar, title_en, summary, slug,
					        COALESCE(ts_rank(search_tsv, websearch_to_tsquery('arabic', $1)), 0) AS ar_rank,
					        COALESCE(ts_rank(search_tsv, websearch_to_tsquery('english', $1)), 0) AS en_rank
					   FROM knowledge_entries
					  WHERE deleted_at IS NULL
					        AND (search_tsv @@ websearch_to_tsquery('arabic', $1)
					          OR search_tsv @@ websearch_to_tsquery('english', $1))
					        ${kindFilter}
					  ORDER BY GREATEST(ar_rank, en_rank) DESC
					  LIMIT $2`
				)
				.all(...params)) as unknown as SearchHit[];
			return rows;
		} catch (err) {
			log.warn({
				msg: 'agent_search_failed',
				query: query.slice(0, 100),
				error: (err as Error).message,
			});
			return [];
		}
	}

	// ---- CRUD: entries -------------------------------------------------
	/** Look up a single entry by id. Returns null if not found or on error. */
	async getEntry(id: number): Promise<KnowledgeEntry | null> {
		try {
			const row = (await this.db
				.prepare('SELECT * FROM knowledge_entries WHERE id = $1 AND deleted_at IS NULL')
				.get(id)) as KnowledgeEntry | undefined;
			return row ?? null;
		} catch (err) {
			log.warn({ msg: 'agent_get_entry_failed', id, error: (err as Error).message });
			return null;
		}
	}

	/** Look up by slug (URL-friendly identifier). */
	async getEntryBySlug(slug: string): Promise<KnowledgeEntry | null> {
		try {
			const row = (await this.db
				.prepare(
					'SELECT * FROM knowledge_entries WHERE slug = $1 AND deleted_at IS NULL LIMIT 1'
				)
				.get(slug)) as KnowledgeEntry | undefined;
			return row ?? null;
		} catch (err) {
			log.warn({ msg: 'agent_get_entry_by_slug_failed', slug, error: (err as Error).message });
			return null;
		}
	}

	/** Recent live entries, newest first. */
	async recentEntries(limit = 20): Promise<KnowledgeEntry[]> {
		try {
			const rows = (await this.db
				.prepare(
					'SELECT * FROM knowledge_entries WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1'
				)
				.all(Math.max(1, Math.min(100, limit)))) as unknown as KnowledgeEntry[];
			return rows;
		} catch (err) {
			log.warn({ msg: 'agent_recent_failed', error: (err as Error).message });
			return [];
		}
	}

	// ---- CRUD: tags ----------------------------------------------------
	/** Upsert a tag by slug. Returns the tag id (or null on failure). */
	async upsertTag(
		slug: string,
		nameAr: string,
		nameEn?: string,
		color?: string
	): Promise<number | null> {
		try {
			const row = (await this.db
				.prepare('SELECT fn_upsert_tag($1, $2, $3, $4) AS id')
				.get(slug, nameAr, nameEn ?? null, color ?? null)) as { id: number } | undefined;
			return row?.id ?? null;
		} catch (err) {
			log.warn({ msg: 'agent_upsert_tag_failed', slug, error: (err as Error).message });
			return null;
		}
	}

	/** Top tags ordered by usage. */
	async topTags(limit = 20): Promise<KnowledgeTag[]> {
		try {
			const rows = (await this.db
				.prepare(
					'SELECT * FROM tags ORDER BY usage_count DESC, name_ar ASC LIMIT $1'
				)
				.all(Math.max(1, Math.min(100, limit)))) as unknown as KnowledgeTag[];
			return rows;
		} catch (err) {
			log.warn({ msg: 'agent_top_tags_failed', error: (err as Error).message });
			return [];
		}
	}

	// ---- Lifecycle ----------------------------------------------------
	/** Gracefully close the underlying pool. Call on SIGTERM. */
	async close(): Promise<void> {
		await this.db.close();
	}
}

// =========================================================================
// 4. Singleton accessor — one AgentDb per process
// =========================================================================
let _instance: AgentDb | null = null;

/**
 * Return the singleton AgentDb, or `null` if agent_db is not configured.
 * Callers should ALWAYS handle the null case (e.g. when running unit
 * tests that don't have an agent_db connection).
 */
export function newAgentDb(): AgentDb | null {
	if (_instance) return _instance;
	const url = resolveAgentUrl();
	if (!url) {
		log.debug({ msg: 'agent_db_not_configured' });
		return null;
	}
	_instance = new AgentDb(url);
	return _instance;
}

/** For tests: reset the singleton so each test gets a fresh AgentDb. */
export function _resetAgentDbForTests(): void {
	_instance = null;
}
