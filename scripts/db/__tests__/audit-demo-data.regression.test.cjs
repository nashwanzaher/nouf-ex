'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'db', 'audit-demo-data.cjs');

function runAudit(env) {
	const result = spawnSync(process.execPath, [SCRIPT], {
		cwd: ROOT,
		env: {
			...process.env,
			...env,
			DATABASE_URL: env.DATABASE_URL || process.env.DATABASE_URL,
			DOTENV_CONFIG_QUIET: 'true',
		},
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	return result;
}

function parseReport(result) {
	if (result.status !== 0) {
		assert.fail(`audit failed (${result.status}): ${result.stderr}`);
	}
	// The script writes a JSON report to stdout; the `dotenv` package prints
	// a one-line tip to stdout when the .env file is parsed. Strip anything
	// that isn't a JSON document.
	const lines = result.stdout.split(/\r?\n/);
	const jsonStart = lines.findIndex((line) => line.startsWith('{'));
	if (jsonStart < 0) {
		assert.fail(`no JSON document in audit output: ${result.stdout.slice(0, 200)}`);
	}
	return JSON.parse(lines.slice(jsonStart).join('\n'));
}

test('audit-demo-data: report contains demo signatures and a stable fingerprint', () => {
	const result = runAudit({});
	const report = parseReport(result);
	assert.ok(
		report.environment === null || typeof report.environment === 'string',
		`environment must be string or null, got ${typeof report.environment}`,
	);
	assert.equal(typeof report.fingerprint, 'string');
	assert.equal(report.fingerprint.length, 64);
	assert.equal(report.target.users.length, 12);
	assert.equal(report.target.stores.length, 7);
	assert.equal(report.target.products.length, 24);
	assert.equal(report.target.orders.length, 8);
	assert.equal(report.target.coupons.length, 4);
	assert.equal(report.unexpected_relations.length, 0);
	assert.equal(report.relations.transactions.length, 8);
	assert.ok(Array.isArray(report.blockers));
});

test('audit-demo-data: re-running produces the same fingerprint (idempotency)', () => {
	const first = runAudit({});
	const second = runAudit({});
	const firstReport = parseReport(first);
	const secondReport = parseReport(second);
	assert.equal(firstReport.fingerprint, secondReport.fingerprint);
});

test('audit-demo-data: transactions query no longer raises integer=text cast error', () => {
	const report = parseReport(runAudit({}));
	const transactions = report.relations.transactions;
	assert.ok(Array.isArray(transactions));
	for (const row of transactions) {
		assert.equal(typeof row.reference_id, 'number');
	}
});
