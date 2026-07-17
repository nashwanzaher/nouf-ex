#!/usr/bin/env node
'use strict';

const path = require('node:path');
const readline = require('node:readline');
const { promisify } = require('node:util');
const { randomBytes, scrypt: scryptCallback } = require('node:crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const CONFIRMATION_LOCK = 'noufex.bootstrap.super_admin';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

function resolveDatabaseUrl() {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
	if (DB_HOST && DB_NAME && DB_USER && DB_PASSWORD) {
		return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT || 5432}/${DB_NAME}`;
	}
	throw new Error('DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD is required');
}

function parseArgs(argv) {
	const args = { email: process.env.BOOTSTRAP_ADMIN_EMAIL || '', passwordStdin: false };
	for (let i = 2; i < argv.length; i += 1) {
		const value = argv[i];
		if (value === '--password-stdin') args.passwordStdin = true;
		else if (value === '--email') args.email = argv[++i] || '';
		else if (value === '--help') {
			console.log('Usage: BOOTSTRAP_ADMIN_PASSWORD=secret node scripts/db/bootstrap-admin.cjs --email admin@example.com');
			console.log('       type secret | node scripts/db/bootstrap-admin.cjs --email admin@example.com --password-stdin');
			process.exit(0);
		} else {
			throw new Error(`Unknown argument: ${value}`);
		}
	}
	return args;
}

function validateEmail(email) {
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
		throw new Error('A valid bootstrap admin email is required');
	}
	return email.trim().toLowerCase();
}

function validatePassword(password, email) {
	if (password.length < 12 || password.length > 128) {
		throw new Error('Bootstrap admin password must be 12 to 128 characters');
	}
	const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password));
	if (classes.length < 3) {
		throw new Error('Bootstrap admin password must contain at least 3 character classes');
	}
	if (password.toLowerCase() === email.split('@')[0]) {
		throw new Error('Bootstrap admin password must not equal the email local-part');
	}
}

async function readPassword(useStdin) {
	if (process.env.BOOTSTRAP_ADMIN_PASSWORD) return process.env.BOOTSTRAP_ADMIN_PASSWORD;
	if (!useStdin) {
		throw new Error('Provide BOOTSTRAP_ADMIN_PASSWORD through a secret manager or use --password-stdin');
	}
	if (process.stdin.isTTY) {
		throw new Error('--password-stdin requires piped input');
	}
	const input = await new Promise((resolve, reject) => {
		let value = '';
		const rl = readline.createInterface({ input: process.stdin });
		rl.on('line', (line) => {
			value += line;
			rl.close();
		});
		rl.on('close', () => resolve(value));
		rl.on('error', reject);
	});
	return String(input).replace(/\r?\n$/, '');
}

async function hashPassword(password) {
	const salt = randomBytes(16);
	const key = await scrypt(password, salt, KEY_LENGTH);
	return `scrypt$${salt.toString('base64')}$${Buffer.from(key).toString('base64')}`;
}

async function createSuperAdmin(client, { email, passwordHash }) {
	await client.query('BEGIN');
	await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [CONFIRMATION_LOCK]);
	const existing = await client.query(
		"SELECT id, email FROM users WHERE role = 'super_admin' AND deleted_at IS NULL ORDER BY id LIMIT 1",
	);
	if (existing.rows.length > 0) {
		await client.query('COMMIT');
		return { created: false, id: existing.rows[0].id, email: existing.rows[0].email };
	}

	const conflicting = await client.query(
		'SELECT id, role FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
		[email],
	);
	if (conflicting.rows.length > 0) {
		throw new Error(`Bootstrap email is already used by user ${conflicting.rows[0].id}`);
	}

	const inserted = await client.query(
		`INSERT INTO users
			(email, password_hash, full_name, role, status, is_verified, email_verified, phone_verified)
		 VALUES ($1, $2, $3, 'super_admin', 'active', TRUE, TRUE, TRUE)
		 RETURNING id, email, role`,
		[email, passwordHash, email.split('@')[0]],
	);
	await client.query('COMMIT');
	return { created: true, ...inserted.rows[0] };
}

async function bootstrapAdmin({ email, password }) {
	const client = new Client({ connectionString: resolveDatabaseUrl() });
	await client.connect();
	try {
		return await createSuperAdmin(client, { email, passwordHash: await hashPassword(password) });
	} catch (error) {
		await client.query('ROLLBACK').catch(() => undefined);
		throw error;
	} finally {
		await client.end();
	}
}

async function main() {
	const args = parseArgs(process.argv);
	const email = validateEmail(args.email);
	const password = await readPassword(args.passwordStdin);
	validatePassword(password, email);
	const result = await bootstrapAdmin({ email, password });
	console.log(JSON.stringify(result));
}

if (require.main === module) {
	main().catch((error) => {
		console.error(`[bootstrap-admin] FAILED: ${error.message}`);
		process.exitCode = 1;
	});
}

module.exports = { bootstrapAdmin, createSuperAdmin, hashPassword, validateEmail, validatePassword };
