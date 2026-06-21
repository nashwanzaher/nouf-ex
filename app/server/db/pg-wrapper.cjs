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
 */
'use strict';

const { Pool } = require('pg');

/** Normalize SQL fragments that are SQLite-flavored but still legal / convenient in pg.
 *  - `datetime('now')`             → `CURRENT_TIMESTAMP`
 *  - `is_<col> = 1` / `is_<col> = 0` → `is_<col> = TRUE` / `is_<col> = FALSE`
 *    (PostgreSQL accepts the integer form via implicit cast but the boolean form is
 *     clearer and silences type-mismatch warnings.)
 */
function normalizeSql(sql) {
	return sql
		.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
		.replace(/\b(is_\w+)\s*=\s*1\b/gi, '$1 = TRUE')
		.replace(/\b(is_\w+)\s*=\s*0\b/gi, '$1 = FALSE');
}

/** Convert `?` placeholders to `$1, $2, ...` for pg. Escape `?` inside string literals is left as-is (best-effort). */
function pgify(sql) {
	let i = 0;
	let out = '';
	let inString = false;
	let stringChar = '';
	for (let k = 0; k < sql.length; k++) {
		const ch = sql[k];
		if (inString) {
			out += ch;
			// naive string terminator: same quote, not preceded by backslash.
			if (ch === stringChar && sql[k - 1] !== '\\') inString = false;
			continue;
		}
		if (ch === "'" || ch === '"') {
			inString = true;
			stringChar = ch;
			out += ch;
			continue;
		}
		if (ch === '?') {
			i++;
			out += '$' + i;
			continue;
		}
		out += ch;
	}
	return out;
}

class PgStatement {
	constructor(pool, sql) {
		this.pool = pool;
		this.sql = sql;
		this.pgSql = pgify(normalizeSql(sql));
	}

	async _query(params) {
		const args = params && params.length ? Array.from(params) : [];
		const res = await this.pool.query(this.pgSql, args);
		return res;
	}

	/** Return all rows. */
	async all(...params) {
		const res = await this._query(params);
		return res.rows;
	}

	/** Return the first row or undefined. */
	async get(...params) {
		const res = await this._query(params);
		return res.rows[0];
	}

	/** Execute a non-SELECT (INSERT/UPDATE/DELETE). Returns { lastInsertRowid, changes }. */
	async run(...params) {
		const res = await this._query(params);
		const lastInsertRowid =
			res.rows && res.rows[0] && res.rows[0].id !== undefined ? res.rows[0].id : null;
		return { lastInsertRowid, changes: res.rowCount || 0 };
	}
}

class PgTxDb {
	constructor(client) {
		this.client = client;
	}
	prepare(sql) {
		const stmt = new PgStatement({ query: (s, p) => this.client.query(s, p) }, sql);
		return stmt;
	}
}

class PgDb {
	constructor(connectionString) {
		const config = {
			connectionString,
			max: 10,
			idleTimeoutMillis: 30_000,
			connectionTimeoutMillis: 5_000,
		};
		// Enable SSL when explicitly requested via DB_SSL env or ?ssl=true in
		// the connection string. Production should set DB_SSL=true (or pass
		// sslmode=require in DATABASE_URL).
		if (process.env.DB_SSL === 'true' || /sslmode=require/.test(connectionString)) {
			config.ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
		}
		this.pool = new Pool(config);
	}

	/** Redact password from a postgres:// URL — safe to log. */
	static redactUrl(url) {
		return url.replace(/:[^:@/]+@/, ':***@');
	}

	prepare(sql) {
		return new PgStatement(this.pool, sql);
	}

	/** Execute `fn` inside a transaction. The callback receives a tx-scoped PgDb-like object. */
	async tx(fn) {
		const client = await this.pool.connect();
		try {
			await client.query('BEGIN');
			const txDb = new PgTxDb(client);
			const out = await fn(txDb);
			await client.query('COMMIT');
			return out;
		} catch (err) {
			try {
				await client.query('ROLLBACK');
			} catch (_) {
				/* ignore */
			}
			throw err;
		} finally {
			client.release();
		}
	}

	async close() {
		await this.pool.end();
	}
}

module.exports = { PgDb };
