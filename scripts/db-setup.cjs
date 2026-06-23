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
 *   8. seed.sql           ── demo data (idempotent via ON CONFLICT)
 *   9. migrations/NNNN_*.sql ── any pending incremental migrations
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

// Resolve `pg` (and `dotenv`) from app/node_modules — the project keeps
// its single node_modules in app/ alongside the front-end and back-end
// code, so the root-level scripts need to look one directory down.
// A clear error is thrown if `pg` is missing so the user knows to
// run `npm install` from the app/ directory.
let Client, dotenv;
try {
    ({ Client } = require(path.join(__dirname, '..', 'app', 'node_modules', 'pg')));
    dotenv = require(path.join(__dirname, '..', 'app', 'node_modules', 'dotenv'));
} catch (err) {
    throw new Error(
        'Cannot resolve `pg` / `dotenv` from app/node_modules. ' +
        'Run `cd app && npm install` first, then re-run this script.',
    );
}

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_DIR       = path.resolve(__dirname, '..', 'database');
const MIGRATIONS   = path.join(DB_DIR, 'migrations');

const PIPELINE = [
    ['0001_baseline',   'migrations/0001_baseline.sql'],
    ['schema',          'schema.sql'],
    ['schema-extra',    'schema-extra.sql'],
    ['views',           'views.sql'],
    ['functions',       'functions.sql'],
    ['triggers',        'triggers.sql'],
    ['roles',           'roles.sql'],
    ['seed',            'seed.sql'],
];

function resolveDatabaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
    if (DB_HOST && DB_NAME && DB_USER && DB_PASSWORD) {
        return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT || 5432}/${DB_NAME}`;
    }
    throw new Error(
        'DATABASE_URL is not set. Copy .env.example to .env and fill in ' +
        'DB_HOST / DB_NAME / DB_USER / DB_PASSWORD (or set DATABASE_URL directly).',
    );
}

async function applyFile(client, label, relPath) {
    const file = path.join(DB_DIR, relPath);
    if (!fs.existsSync(file)) {
        console.warn(`[db:setup] (skip) ${label}: ${relPath} not found`);
        return;
    }
    const sql = fs.readFileSync(file, 'utf8');
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
        const version = file.split('_')[0];
        const { rows } = await client.query(
            'SELECT 1 FROM schema_migrations WHERE version = $1',
            [version],
        );
        if (rows.length > 0) {
            console.log(`[db:setup]   migration ${file} — already applied, skipping`);
            continue;
        }
        const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
        console.log(`[db:setup]   applying migration ${file} (${sql.length} bytes)…`);
        await client.query('BEGIN');
        try {
            await client.query(sql);
            await client.query(
                'INSERT INTO schema_migrations (version, description) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [version, file.replace(/^\d{4}_/, '').replace(/\.sql$/, '').replace(/_/g, ' ')],
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
        console.log('[db:setup] done.');
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('[db:setup] FAILED:', err.message);
    process.exit(1);
});
