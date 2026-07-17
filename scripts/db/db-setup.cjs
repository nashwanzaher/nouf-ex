#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * One-time (and idempotent) database setup for noufex_db.
 *
 * Reads DATABASE_URL (or DB_* vars) from the environment / .env, then
 * applies the canonical project state in this order:
 *
 *   1. 0001_baseline.sql  ── creates `schema_migrations` tracking table
 *   2. schema.sql         ── base tables, indexes, CHECK constraints
 *   3. schema-extra.sql   ── payments, coupons, refunds, balances, audit
 *   4. views.sql          ── v_product_with_store, v_store_stats, …
 *   5. functions.sql      ── PL/pgSQL trigger functions
 *   6. triggers.sql       ── wires functions to tables
 *   7. roles.sql          ── noufex_app, noufex_owner, noufex_readonly + GRANTs
 *   8. reference-seed.sql ── production-safe reference rows
 *   9. demo-seed.sql      ── development/test-only demo rows
 *  10. migrations/NNNN_*.sql ── any pending incremental migrations
 *
 * All steps use IF NOT EXISTS / OR REPLACE / ON CONFLICT, so the script
 * is safe to re-run on a fully-seeded database.
 *
 * Usage:
 *   npm run db:setup
 *   DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/noufex_db npm run db:setup
 *     (postgres is the superuser; only needed once for role creation.)
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Resolve `pg` (and `dotenv`) from the monorepo root's hoisted
// node_modules. npm workspaces hoist every dep to /node_modules at
// the repo root, so the scripts/ folder (one level deep) can reach
// them by walking up one directory.
let Client, dotenv;
try {
	({ Client } = require(path.join(__dirname, '..', '..', 'node_modules', 'pg')));
	dotenv = require(path.join(__dirname, '..', '..', 'node_modules', 'dotenv'));
} catch (err) {
	throw new Error(
		'Cannot resolve `pg` / `dotenv` from the monorepo node_modules. ' +
			'Run `npm install` at the repo root first, then re-run this script.'
	);
}

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const DB_DIR = path.resolve(__dirname, '..', '..', 'packages', 'db');
const MIGRATIONS = path.join(DB_DIR, 'migrations');

const PIPELINE = [
	['0001_baseline', 'migrations/0001_baseline.sql'],
	['schema', 'schema.sql'],
	['schema-extra', 'schema-extra.sql'],
	['views', 'views.sql'],
	['functions', 'functions.sql'],
	['triggers', 'triggers.sql'],
];

function resolveDatabaseUrl() {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
	if (DB_HOST && DB_NAME && DB_USER && DB_PASSWORD) {
		return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT || 5432}/${DB_NAME}`;
	}
	throw new Error(
		'DATABASE_URL is not set. Copy .env.example to .env and fill in ' +
			'DB_HOST / DB_NAME / DB_USER / DB_PASSWORD (or set DATABASE_URL directly).'
	);
}

async function applyFile(client, label, relPath) {
	const file = path.join(DB_DIR, relPath);
	if (!fs.existsSync(file)) {
		console.warn(`[db:setup] (skip) ${label}: ${relPath} not found`);
		return;
	}
	let sql = fs.readFileSync(file, 'utf8');
	// Substitute psql-style variables `:'VAR_NAME'` with single-quoted
	// env values so files written for `psql -v` still work via node-pg.
	// (Only roles.sql currently uses these; falls back to DB_PASSWORD
	// for any missing var so dev setups with a single password keep
	// working.)
	sql = sql.replace(/:'([A-Z_][A-Z0-9_]*)'/g, (_match, name) => {
		const value = process.env[name] || process.env.DB_PASSWORD || 'CHANGE_ME';
		return `'${String(value).replace(/'/g, "''")}'`;
	});
	console.log(`[db:setup] applying ${label}  (${relPath}, ${sql.length} bytes)…`);
	await client.query(sql);
}

async function applyPendingMigrations(client) {
	if (!fs.existsSync(MIGRATIONS)) return;
	const files = fs
		.readdirSync(MIGRATIONS)
		.filter((f) => /^\d{4}_.+\.sql$/.test(f))
		.sort();

	for (const file of files) {
		// Use the full filename minus the .sql extension as the
		// version key. The PK on schema_migrations.version is a
		// VARCHAR(20) so a 4-digit number AND a longer descriptive
		// string both fit. The descriptive form (`0007_pi_unique_pair`
		// rather than just `0007`) is what the live DB currently
		// holds; using the short form here would create a 13th
		// row on every `npm run db:setup` run because the PK
		// wouldn't conflict.
		const version = file.replace(/\.sql$/, '');
		const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [
			version,
		]);
		if (rows.length > 0) {
			console.log(`[db:setup]   migration ${file} — already applied, skipping`);
			continue;
		}
		const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
		console.log(`[db:setup]   applying migration ${file} (${sql.length} bytes)…`);
		await client.query('BEGIN');
		try {
			await client.query(sql);
			// Description matches the format the live DB uses:
			// `Migration 0007_pi_unique_pair`. The ON CONFLICT
			// clause is defensive: if a future re-derivation of
			// `version` collides with an existing row, the second
			// INSERT is silently dropped instead of erroring.
			await client.query(
				'INSERT INTO schema_migrations (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
				[version, `Migration ${version}`]
			);
			await client.query('COMMIT');
			console.log(`[db:setup]   ✓ migration ${file} applied`);
		} catch (err) {
			await client.query('ROLLBACK');
			throw new Error(`migration ${file} failed: ${err.message}`);
		}
	}
}

async function main() {
	const url = resolveDatabaseUrl();
	console.log('[db:setup] target:', url.replace(/:[^:@/]+@/, ':***@'));

	const client = new Client({ connectionString: url });
	await client.connect();

	try {
		for (const [label, relPath] of PIPELINE) {
			await applyFile(client, label, relPath);
		}
		await applyPendingMigrations(client);
		await applyFile(client, 'reference-seed', 'reference-seed.sql');
		await applyFile(client, 'roles', 'roles.sql');

		if (process.env.NODE_ENV === 'production') {
			console.warn('[db:setup] (skip) demo-seed: NODE_ENV=production');
		} else {
			await client.query("SET noufex.allow_demo_seed = 'on'");
			await client.query("SELECT set_config('noufex.environment', $1, false)", [
				process.env.NODE_ENV || 'development',
			]);
			await applyFile(client, 'demo-seed', 'demo-seed.sql');
		}
		console.log('[db:setup] done.');
	} finally {
		await client.end();
	}
}

main().catch((err) => {
	console.error('[db:setup] FAILED:', err.message);
	process.exit(1);
});
