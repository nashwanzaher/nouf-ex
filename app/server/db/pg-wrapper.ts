/**
 * PgDb — a thin async wrapper over `pg.Pool` that mimics the parts of the
 * better-sqlite3 API the Nouf-ex API server relies on:
 *
 *   const db = new PgDb(connectionString);
 *   const rows    = await db.prepare('SELECT * FROM t WHERE id = $1').all(7);
 *   const one     = await db.prepare('SELECT * FROM t WHERE id = $1').get(7);
 *   const r       = await db.prepare('DELETE FROM t WHERE id = $1').run(7);
 *   await db.tx(async (txDb) => { ... });
 *   await db.close();
 *
 * Differences vs. better-sqlite3 that callers must respect:
 *   - All methods are async (return Promises).
 *   - SQL placeholders stay as `?` — this wrapper rewrites them to $1, $2, ...
 *   - `db.prepare(...).run(...)` returns `{ rowCount, lastInsertRowid }`.
 *   - `db.tx(fn)` runs `fn` inside a BEGIN/COMMIT (or ROLLBACK on throw).
 *   - JSON columns: pg returns already-parsed JS values for JSONB.
 *   - Booleans: pg returns real booleans (no 0/1 normalization needed).
 *
 * Module type: this file is `.ts` (ESM TypeScript) so the dev
 * runtime (`tsx`) can find it when `server/index.ts` imports the
 * wrapper. esbuild compiles it to ESM for the production bundle.
 */
import { Pool } from 'pg';

/** Normalize SQL fragments that are SQLite-flavored but still legal / convenient in pg.
 *  - `datetime('now')`             → `CURRENT_TIMESTAMP`
 *  - `is_<col> = 1` / `is_<col> = 0` → `is_<col> = TRUE` / `is_<col> = FALSE`
 *    (PostgreSQL accepts the integer form via implicit cast but the boolean form is
 *     clearer and silences type-mismatch warnings.)
 *
 *  SECURITY: rewrites are only applied OUTSIDE string literals. Without
 *  this guard, a SQL like
 *    SELECT 'is_active = 1' AS label
 *  would have its string body corrupted (the `is_active = 1` inside the
 *  literal would become `is_active = TRUE`, producing a different value).
 *  We use the same state machine as `pgify` (single-quoted strings with
 *  `''` escapes, double-quoted identifiers, dollar-quoted strings, line
 *  comments) to track whether the cursor is inside a literal.
 */
export function normalizeSql(sql: string): string {
	let out = '';
	let i = 0;
	const len = sql.length;
	while (i < len) {
		const ch = sql[i];
		// Skip string literals verbatim
		if (ch === "'") {
			let j = i + 1;
			while (j < len) {
				if (sql[j] === "'" && sql[j + 1] === "'") {
					j += 2; // doubled-quote escape
					continue;
				}
				if (sql[j] === "'") {
					j++;
					break;
				}
				j++;
			}
			out += sql.slice(i, j);
			i = j;
			continue;
		}
		// Skip double-quoted identifiers verbatim
		if (ch === '"') {
			let j = i + 1;
			while (j < len) {
				if (sql[j] === '"' && sql[j + 1] === '"') {
					j += 2;
					continue;
				}
				if (sql[j] === '"') {
					j++;
					break;
				}
				j++;
			}
			out += sql.slice(i, j);
			i = j;
			continue;
		}
		// Skip dollar-quoted strings ($tag$ ... $tag$) verbatim
		if (ch === '$') {
			const tagMatch = sql.slice(i).match(/^(\$[A-Za-z0-9_]*\$)/);
			if (tagMatch) {
				const tag = tagMatch[1];
				const endIdx = sql.indexOf(tag, i + tag.length);
				if (endIdx !== -1) {
					const stop = endIdx + tag.length;
					out += sql.slice(i, stop);
					i = stop;
					continue;
				}
			}
		}
		// Skip line comments
		if (ch === '-' && sql[i + 1] === '-') {
			const j = sql.indexOf('\n', i);
			const stop = j === -1 ? len : j;
			out += sql.slice(i, stop);
			i = stop;
			continue;
		}
		// Apply the `datetime('now')` rewrite
		if (sql.slice(i, i + 16).toLowerCase() === "datetime('now')") {
			out += 'CURRENT_TIMESTAMP';
			i += 16;
			continue;
		}
		// Apply is_<col> = 1 / is_<col> = 0 rewrites
		const isTrueMatch = sql.slice(i).match(/^(\bis_\w+)\s*=\s*1\b/i);
		if (isTrueMatch) {
			out += `${isTrueMatch[1]} = TRUE`;
			i += isTrueMatch[0].length;
			continue;
		}
		const isFalseMatch = sql.slice(i).match(/^(\bis_\w+)\s*=\s*0\b/i);
		if (isFalseMatch) {
			out += `${isFalseMatch[1]} = FALSE`;
			i += isFalseMatch[0].length;
			continue;
		}
		out += ch;
		i++;
	}
	return out;
}

/**
 * Rewrite `?` placeholders to `$1, $2, ...` for pg. The previous
 * implementation used a single `inString` flag and treated
 * backslash-escaped quotes as the terminator — that broke for the
 * common PostgreSQL convention of doubling a quote to escape it
 * inside a string literal (`'it''s'`), at which point the rewriter
 * would fall out of the string and turn the rest of the literal
 * into SQL (including any `?` inside it).
 *
 * P1-8 fix: a small state machine that recognises
 *   - single-quoted strings with `''` escapes,
 *   - E-strings (E'...') with backslash escapes,
 *   - double-quoted identifiers with `""` escapes,
 *   - dollar-quoted strings ($$ ... $$ or $tag$ ... $tag$),
 *   - line comments (-- ... \n) and nested block comments (/* ... *\/).
 *
 * Anything that is not a `?` outside a quoted region is copied
 * verbatim, so the only place placeholders are rewritten is inside
 * actual SQL.
 */
export function pgify(sql: string): string {
	let out = '';
	let i = 0;
	let k = 0;
	const len = sql.length;

	const copyVerbatim = (end: number) => {
		out += sql.slice(k, end);
		k = end;
	};

	while (k < len) {
		const ch = sql[k];

		// ── Line comment: -- to end of line or end of input ──
		if (ch === '-' && sql[k + 1] === '-') {
			const eol = sql.indexOf('\n', k + 2);
			copyVerbatim(eol === -1 ? len : eol);
			continue;
		}

		// ── Block comment: /* ... */ (nesting allowed by pg) ──
		if (ch === '/' && sql[k + 1] === '*') {
			let depth = 1;
			let cursor = k + 2;
			while (cursor < len && depth > 0) {
				if (sql[cursor] === '/' && sql[cursor + 1] === '*') {
					depth++;
					cursor += 2;
				} else if (sql[cursor] === '*' && sql[cursor + 1] === '/') {
					depth--;
					cursor += 2;
				} else {
					cursor++;
				}
			}
			copyVerbatim(cursor);
			continue;
		}

		// ── E-string: E'...' with backslash escapes and '' doubling ──
		if ((ch === 'E' || ch === 'e') && sql[k + 1] === "'") {
			out += ch + "'";
			k += 2;
			while (k < len) {
				const c = sql[k];
				if (c === '\\' && k + 1 < len) {
					out += c + sql[k + 1];
					k += 2;
					continue;
				}
				if (c === "'" && sql[k + 1] === "'") {
					out += "''";
					k += 2;
					continue;
				}
				if (c === "'") {
					out += c;
					k++;
					break;
				}
				out += c;
				k++;
			}
			continue;
		}

		// ── Single-quoted string: '...' with '' doubling ──
		if (ch === "'") {
			out += ch;
			k++;
			while (k < len) {
				const c = sql[k];
				if (c === "'" && sql[k + 1] === "'") {
					out += "''";
					k += 2;
					continue;
				}
				if (c === "'") {
					out += c;
					k++;
					break;
				}
				out += c;
				k++;
			}
			continue;
		}

		// ── Double-quoted identifier: "..." with "" doubling ──
		if (ch === '"') {
			out += ch;
			k++;
			while (k < len) {
				const c = sql[k];
				if (c === '"' && sql[k + 1] === '"') {
					out += '""';
					k += 2;
					continue;
				}
				if (c === '"') {
					out += c;
					k++;
					break;
				}
				out += c;
				k++;
			}
			continue;
		}

		// ── Dollar-quoted string: $$ ... $$ or $tag$ ... $tag$ ──
		// Used by PL/pgSQL function bodies, DO blocks, etc.
		if (ch === '$') {
			const tagMatch = sql.slice(k).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
			if (tagMatch) {
				const tag = tagMatch[0];
				out += tag;
				k += tag.length;
				const endIdx = sql.indexOf(tag, k);
				if (endIdx === -1) {
					// Unterminated dollar quote — copy to end of input.
					copyVerbatim(len);
				} else {
					copyVerbatim(endIdx);
					out += tag;
					k = endIdx + tag.length;
				}
				continue;
			}
		}

		// ── Placeholder ──
		if (ch === '?') {
			i++;
			out += '$' + i;
			k++;
			continue;
		}

		// ── Everything else: copy through ──
		out += ch;
		k++;
	}
	return out;
}

/** Minimal interface for a pg-compatible query executor. */
interface QueryExecutor {
	query: (
		sql: string,
		params: unknown[],
	) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

interface RunResult {
	lastInsertRowid: number | string | null;
	changes: number;
}

class PgStatement {
	private readonly pool: QueryExecutor;
	private readonly pgSql: string;

	constructor(pool: QueryExecutor, sql: string) {
		this.pool = pool;
		this.pgSql = pgify(normalizeSql(sql));
	}

	private async _query(
		params: unknown[],
	): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> {
		const args = params && params.length ? Array.from(params) : [];
		const res = await this.pool.query(this.pgSql, args);
		return res;
	}

	/** Return all rows. */
	async all(...params: unknown[]): Promise<Record<string, unknown>[]> {
		const res = await this._query(params);
		return res.rows;
	}

	/** Return the first row or undefined. */
	async get(...params: unknown[]): Promise<Record<string, unknown> | undefined> {
		const res = await this._query(params);
		return res.rows[0];
	}

	/** Execute a non-SELECT (INSERT/UPDATE/DELETE). Returns { lastInsertRowid, changes }. */
	async run(...params: unknown[]): Promise<RunResult> {
		const res = await this._query(params);
		const lastInsertRowid =
			res.rows && res.rows[0] && res.rows[0].id !== undefined
				? (res.rows[0].id as string | number)
				: null;
		return { lastInsertRowid, changes: res.rowCount || 0 };
	}
}

export class PgTxDb {
	private readonly client: {
		query: (
			sql: string,
			params: unknown[],
		) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
	};

	constructor(client: {
		query: (
			sql: string,
			params: unknown[],
		) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
	}) {
		this.client = client;
	}
	prepare(sql: string): PgStatement {
		const stmt = new PgStatement({ query: (s, p) => this.client.query(s, p) }, sql);
		return stmt;
	}
}

export class PgDb {
	private readonly pool: Pool;

	constructor(connectionString: string) {
		const rawMax = process.env.DB_POOL_MAX;
		let poolMax = 20;
		if (rawMax !== undefined && rawMax !== '') {
			const parsed = Number(rawMax);
			if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 1000) {
				poolMax = Math.floor(parsed);
			}
			// If invalid, fall back to default 20 silently — the env
			// var is for tuning, not a security boundary.
		}
		const config = {
			connectionString,
			max: poolMax,
			idleTimeoutMillis: 30_000,
			connectionTimeoutMillis: 5_000,
		};
		// Enable SSL when explicitly requested via DB_SSL env or ?ssl=true in
		// the connection string. Production should set DB_SSL=true (or pass
		// sslmode=require in DATABASE_URL).
		if (process.env.DB_SSL === 'true' || /sslmode=require/.test(connectionString)) {
			(config as { ssl?: unknown }).ssl = {
				rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
			};
		}
		this.pool = new Pool(config);
	}

	/** Redact password from a postgres:// URL — safe to log. */
	static redactUrl(url: string): string {
		return url.replace(/:[^:@/]+@/, ':***@');
	}

	prepare(sql: string): PgStatement {
		return new PgStatement(this.pool, sql);
	}

	/** Execute `fn` inside a transaction. The callback receives a tx-scoped PgDb-like object. */
	async tx<T>(fn: (txDb: PgTxDb) => Promise<T>): Promise<T> {
		const client = await this.pool.connect();
		try {
			await client.query('BEGIN', []);
			const txDb = new PgTxDb(client);
			const out = await fn(txDb);
			await client.query('COMMIT', []);
			return out;
		} catch (err) {
			try {
				await client.query('ROLLBACK', []);
			} catch (_) {
				/* ignore */
			}
			throw err;
		} finally {
			client.release();
		}
	}

	async close(): Promise<void> {
		await this.pool.end();
	}
}
