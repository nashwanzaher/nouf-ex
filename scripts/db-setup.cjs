#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * One-time database setup for the external PostgreSQL 17 server.
 *
 * Reads DATABASE_URL (or DB_* vars) from the environment / .env, then applies
 * the schema files in this order:
 *
 *   1. ../database/schema.sql        (base tables + indexes)
 *   2. ../database/schema-extra.sql  (payments, coupons, refunds, …)
 *   3. ../database/seed.sql          (seed data)
 *
 * All three use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
 * so the script is idempotent: re-running it on an already-seeded database
 * is a no-op for DDL and will INSERT new rows only if the seed file uses
 * ON CONFLICT.
 *
 * Usage:
 *   npm run db:setup                # from app/
 *   DATABASE_URL=... node scripts/db-setup.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load .env from the project root (scripts/ is one level deep).
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const FILES = [
  'database/schema.sql',
  'database/schema-extra.sql',
  'database/seed.sql',
];

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  if (DB_HOST && DB_NAME && DB_USER && DB_PASSWORD) {
    return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT || 5432}/${DB_NAME}`;
  }
  throw new Error(
    'DATABASE_URL is not set. Define it in .env or pass it inline:\n' +
      '  DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/noufex_db npm run db:setup',
  );
}

async function main() {
  const url = resolveDatabaseUrl();
  const root = path.resolve(__dirname, '..');

  console.log('[db:setup] target:', url.replace(/:[^:@/]+@/, ':***@'));

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    for (const rel of FILES) {
      const file = path.join(root, rel);
      if (!fs.existsSync(file)) {
        console.warn(`[db:setup] (skip) missing file: ${rel}`);
        continue;
      }
      const sql = fs.readFileSync(file, 'utf8');
      console.log(`[db:setup] applying ${rel} (${sql.length} bytes)…`);
      await client.query(sql);
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
