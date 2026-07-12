#!/usr/bin/env node
/**
 * Reset all seed user passwords to a single value.
 * Usage: node scripts/reset-all-passwords.cjs [newPassword]
 */
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);
const path = require('path');
const fs = require('fs');

const newPassword = process.argv[2] || '656650';

// Load .env
const envPath = path.resolve(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
	const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
	if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

async function hash(pw) {
	const salt = randomBytes(16);
	const key = await scryptAsync(pw, salt, 64);
	return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

(async () => {
	const url = process.env.DATABASE_URL;
	console.log('target:', url.replace(/:[^:@/]+@/, ':***@'));
	const { Client } = require(path.join(__dirname, '..', 'node_modules', 'pg'));
	const client = new Client({ connectionString: url });
	await client.connect();
	try {
		const stored = await hash(newPassword);
		const { rowCount } = await client.query(
			'UPDATE users SET password_hash = $1',
			[stored],
		);
		console.log(`OK — ${rowCount} users updated to password "${newPassword}"`);
	} finally {
		await client.end();
	}
})().catch((e) => {
	console.error('FAILED:', e.message);
	process.exit(1);
});
