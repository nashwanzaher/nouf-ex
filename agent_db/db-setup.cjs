#!/usr/bin/env node
/* ============================================================================
 * agent_db — one-time setup CLI
 * ----------------------------------------------------------------------------
 * Reads AGENT_DATABASE_URL (or AGENT_DB_* env vars), connects as the
 * `postgres` superuser, applies the 6-file pipeline (schema + functions +
 * triggers + views + roles + seed) plus any pending migrations.
 *
 * Mirrors scripts/db-setup.cjs (the noufex_db pipeline).
 * ============================================================================
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const HERE = __dirname;
const AGENT_DIR = HERE;

// ANSI colors
const c = {
    red:    (s) => `\x1b[31m${s}\x1b[0m`,
    green:  (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
    bold:   (s) => `\x1b[1m${s}\x1b[0m`,
    dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

// -- load .env (best effort) -------------------------------------------------
function loadDotenv() {
    const envPath = path.join(ROOT, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        if (m[1].startsWith('#') || process.env[m[1]] !== undefined) continue;
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
        }
        process.env[m[1]] = v;
    }
}

function resolveSuperuserUrl() {
    if (process.env.AGENT_SUPERUSER_URL) return process.env.AGENT_SUPERUSER_URL;
    if (process.env.AGENT_DATABASE_URL) {
        // We need the superuser, not `agent_app`. Reconstruct from env pieces.
        const host = process.env.AGENT_DB_HOST || 'localhost';
        const port = process.env.AGENT_DB_PORT || '5433';
        const db   = process.env.AGENT_DB_NAME || 'agent_db';
        const pw   = process.env.POSTGRES_PASSWORD || 'postgres';
        return `postgresql://postgres:${encodeURIComponent(pw)}@${host}:${port}/${db}`;
    }
    throw new Error('AGENT_DATABASE_URL (or AGENT_DB_* + POSTGRES_PASSWORD) is required');
}

function readSql(name) {
    const p = path.join(AGENT_DIR, name);
    if (!fs.existsSync(p)) {
        throw new Error(`Missing SQL file: ${p}`);
    }
    return fs.readFileSync(p, 'utf8');
}

async function applyMigration(client, file) {
    const version = path.basename(file, '.sql');
    const { rows } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [version]
    );
    if (rows.length > 0) {
        console.log(`  ${c.dim('skip')}  ${version} (already applied)`);
        return false;
    }
    const sql = fs.readFileSync(file, 'utf8');
    // Wrap in a transaction so partial failures roll back.
    await client.query('BEGIN');
    try {
        await client.query(sql);
        await client.query(
            `INSERT INTO schema_migrations (version, description)
             VALUES ($1, $2)
             ON CONFLICT (version) DO NOTHING`,
            [version, `Migration ${version}`]
        );
        await client.query('COMMIT');
        console.log(`  ${c.green('apply')}  ${version}`);
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
}

async function main() {
    loadDotenv();
    const url = resolveSuperuserUrl();
    // Never log the full URL — it contains the password.
    const safeUrl = url.replace(/:[^:@/]+@/, ':***@');
    console.log(c.bold(c.cyan('\n[agent_db]')), 'connecting to', safeUrl);

    const client = new Client({ connectionString: url });
    await client.connect();
    try {
        // Apply the baseline pipeline in dependency order.
        console.log(c.bold('\n[1/6]') + ' schema.sql');
        await client.query(readSql('schema.sql'));

        console.log(c.bold('[2/6]') + ' functions.sql');
        await client.query(readSql('functions.sql'));

        console.log(c.bold('[3/6]') + ' triggers.sql');
        await client.query(readSql('triggers.sql'));

        console.log(c.bold('[4/6]') + ' views.sql');
        await client.query(readSql('views.sql'));

        console.log(c.bold('[5/6]') + ' roles.sql');
        await client.query(readSql('roles.sql'));

        console.log(c.bold('[6/6]') + ' seed.sql');
        await client.query(readSql('seed.sql'));

        // Apply any pending migrations in version order.
        const migDir = path.join(AGENT_DIR, 'migrations');
        if (fs.existsSync(migDir)) {
            const files = fs
                .readdirSync(migDir)
                .filter((f) => /^\d{4}_.+\.sql$/.test(f))
                .sort();
            if (files.length > 0) {
                console.log(c.bold('\n[migrations]'));
                for (const f of files) {
                    await applyMigration(client, path.join(migDir, f));
                }
            }
        }

        // Final summary.
        const { rows: tables } = await client.query(
            `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`
        );
        const { rows: views } = await client.query(
            `SELECT count(*)::int AS n FROM pg_views WHERE schemaname = 'public'`
        );
        const { rows: entries } = await client.query(
            `SELECT count(*)::int AS n FROM knowledge_entries WHERE deleted_at IS NULL`
        );
        const { rows: tags } = await client.query(
            `SELECT count(*)::int AS n FROM tags`
        );

        console.log(c.green('\n✓ agent_db ready'));
        console.log(`  tables:      ${tables[0].n}`);
        console.log(`  views:       ${views[0].n}`);
        console.log(`  entries:     ${entries[0].n}`);
        console.log(`  tags:        ${tags[0].n}`);
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error(c.red('\n✗ agent_db setup failed:'), err.message);
    process.exit(1);
});
