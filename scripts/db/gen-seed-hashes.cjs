#!/usr/bin/env node
/**
 * scripts/gen-seed-hashes.cjs
 *
 * Self-contained scrypt password hashing for the seed users.
 *
 * Two modes:
 *   --print   (default) Print `UPDATE users SET password_hash = ...`
 *                     statements for the SEED_USERS list.
 *   --apply            Connect to the DB (using .env DATABASE_URL or
 *                     DB_* vars) and UPSERT the password_hash on each
 *                     SEED_USER. The actual user record (full_name,
 *                     role, etc.) is left alone — that data lives in
 *                     demo-seed.sql and is the source of truth for
 *                     new development installs. The script is blocked
 *                     in production.
 *
 * Format: `scrypt$<salt_b64>$<hash_b64>` (matches the server's
 * hashPassword() / verifyPassword() implementation).
 *
 * Examples:
 *   node scripts/gen-seed-hashes.cjs                # print SQL
 *   node scripts/gen-seed-hashes.cjs --apply        # write to DB
 *   node scripts/gen-seed-hashes.cjs --print --email=admin@noufex.com
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);

const SCRYPT_KEYLEN = 64;

const SEED_USERS = [
	['ahmed@gmail.com', 'customer123', 'customer'],
	['sara@gmail.com', 'customer123', 'customer'],
	['omar@gmail.com', 'customer123', 'customer'],
	['fatima@spice-yemen.com', 'merchant123', 'merchant'],
	['hassan@dates-yemen.com', 'merchant123', 'merchant'],
	['mohammed@handicrafts-yemen.com', 'merchant123', 'merchant'],
	['khalid@electronics-yemen.com', 'merchant123', 'merchant'],
	['noor@perfume-yemen.com', 'merchant123', 'merchant'],
	['layla@mokha-coffee.com', 'merchant123', 'merchant'],
];

function parseArgs(argv) {
	const args = { mode: 'print', email: null, dryRun: false };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--apply') args.mode = 'apply';
		else if (a === '--print') args.mode = 'print';
		else if (a === '--dry-run') args.dryRun = true;
		else if (a.startsWith('--email=')) args.email = a.split('=')[1];
		else if (a === '--email') args.email = argv[++i];
		else if (a === '-h' || a === '--help') {
			console.log(
				'Usage: node scripts/gen-seed-hashes.cjs [--print|--apply] [--email=<addr>] [--dry-run]\n' +
					'  --print    Print UPDATE statements (default)\n' +
					'  --apply    Connect to the DB and UPSERT password_hash\n' +
					'  --email    Limit to a single email\n' +
					'  --dry-run  With --apply, show SQL without running it'
			);
			process.exit(0);
		} else {
			console.error(`Unknown argument: ${a}`);
			process.exit(2);
		}
	}
	return args;
}

async function generateHash(password) {
	const salt = randomBytes(16);
	// Match the server's hashPassword() in apps/api/src/index.ts — pass
	// the raw Buffer to scrypt, base64-encode both halves for storage.
	const derivedKey = await scryptAsync(password, salt, SCRYPT_KEYLEN);
	return `scrypt$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
}

async function runPrint(users) {
	for (const [email, password] of users) {
		const stored = await generateHash(password);
		const [saltB64, keyB64] = stored.split('$').slice(1);
		console.log(
			`-- ${email} / ${password}\n` +
				`UPDATE users SET password_hash = 'scrypt$$' || encode('${saltB64}', 'base64') || '$$' || encode('${keyB64}', 'base64')\n` +
				`  WHERE email = '${email}';\n`
		);
	}
}

function loadEnv() {
	const envPath = path.resolve(__dirname, '..', '..', '.env');
	if (!fs.existsSync(envPath)) return;
	for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
		const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
		if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
	}
}

function resolveDatabaseUrl() {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
	if (DB_HOST && DB_NAME && DB_USER && DB_PASSWORD) {
		return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT || 5432}/${DB_NAME}`;
	}
	throw new Error('No DATABASE_URL or DB_* env vars set (looked in .env).');
}

async function runApply(users, { dryRun }) {
	loadEnv();
	if (process.env.NODE_ENV === 'production') {
		throw new Error('demo seed hash updates are disabled when NODE_ENV=production');
	}
	let Client;
	try {
		({ Client } = require(path.join(__dirname, '..', '..', 'node_modules', 'pg')));
	} catch (err) {
		throw new Error(
			'pg is not resolvable from the monorepo node_modules. Run `npm install` ' +
				'at the repo root first, or invoke with --print to get the SQL instead.'
		);
	}
	const url = resolveDatabaseUrl();
	const client = new Client({ connectionString: url });
	await client.connect();
	try {
		for (const [email, password, role] of users) {
			const stored = await generateHash(password);
			if (dryRun) {
				console.log(
					`[dry-run] would UPSERT users.email=${email} role=${role} password_hash=${stored.slice(0, 20)}…`
				);
				continue;
			}
			// demo-seed.sql is intentionally development/test-only.
			await client.query(
				`INSERT INTO users (email, password_hash, full_name, role, status, is_verified, email_verified, phone_verified, preferred_language)
         VALUES ($1, $2, $3, $4, 'active', TRUE, TRUE, FALSE, 'ar')
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               role          = EXCLUDED.role`,
				[email, stored, email.split('@')[0], role]
			);
			console.log(`  ✓ ${email} (role=${role})`);
		}
	} finally {
		await client.end();
	}
}

(async () => {
	const args = parseArgs(process.argv);
	const users = args.email ? SEED_USERS.filter(([e]) => e === args.email) : SEED_USERS;
	if (users.length === 0) {
		console.error(`No matching seed users for email=${args.email}`);
		process.exit(1);
	}
	if (args.mode === 'apply') {
		await runApply(users, { dryRun: args.dryRun });
	} else {
		await runPrint(users);
	}
})().catch((err) => {
	console.error(`FATAL: ${err.message}`);
	process.exit(1);
});
