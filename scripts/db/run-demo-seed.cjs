#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

function resolveDatabaseUrl() {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
	if (DB_HOST && DB_NAME && DB_USER && DB_PASSWORD) {
		return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT || 5432}/${DB_NAME}`;
	}
	throw new Error('DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD is required');
}

async function main() {
	if (process.env.NODE_ENV === 'production') {
		throw new Error('demo-seed is disabled when NODE_ENV=production');
	}

	const client = new Client({ connectionString: resolveDatabaseUrl() });
	await client.connect();
	try {
		await client.query("SET noufex.allow_demo_seed = 'on'");
		await client.query("SELECT set_config('noufex.environment', $1, false)", [
			process.env.NODE_ENV || 'development',
		]);
		await client.query(fs.readFileSync(path.resolve(__dirname, '..', '..', 'packages', 'db', 'demo-seed.sql'), 'utf8'));
		console.log('[db:demo-seed] applied');
	} finally {
		await client.end();
	}
}

main().catch((error) => {
	console.error('[db:demo-seed] FAILED:', error.message);
	process.exitCode = 1;
});
