#!/usr/bin/env node
/**
 * One-off script: rewrite all stale `apps/api/src` / `apps/api/dist` / `apps/web` /
 * `apps/web/src` / `.cts` references in source comments, docs, and e2e scripts.
 *
 * Replaces the deleted `scripts/maintenance/rename-cts-references.cjs`
 * which only handled the `.cts` → `.ts` rename but missed the broader
 * 2026-07-11 monorepo restructure (`apps/api/src` → `apps/api/src`, etc.).
 *
 * The script is idempotent: running it twice produces no further changes.
 *
 * Mappings:
 *   apps/api/src       → apps/api/src
 *   apps/api/dist         → apps/api/dist
 *   apps/web          → apps/web
 *   apps/web/src          → apps/web/src
 *   shared.ts       → shared.ts
 *   *.cts (comments) → *.ts
 */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const SKIP_DIRS = new Set([
	'.git', 'node_modules', 'dist', 'coverage', '.turbo', 'apps/mcp-server/dist',
]);

const TEXT_EXT = new Set([
	'.ts', '.tsx', '.cts', '.mts',
	'.js', '.cjs', '.mjs',
	'.md', '.mdx',
	'.ps1', '.psm1', '.psd1',
	'.sh', '.bash',
	'.sql',
	'.yml', '.yaml',
	'.json', '.jsonc',
	'.html',
]);

const REPLACEMENTS = [
	// Specific long patterns first (more specific wins).
	['apps/api/src/routes/', 'apps/api/src/routes/'],
	['apps/api/src/lib/', 'apps/api/src/lib/'],
	['apps/api/src/modules/', 'apps/api/src/modules/'],
	['apps/api/src/tests/', 'apps/api/src/tests/'],
	['apps/api/src/index.ts', 'apps/api/src/index.ts'],
	['apps/api/src/middleware.ts', 'apps/api/src/middleware.ts'],
	['apps/api/src', 'apps/api/src'],
	['apps/api/dist', 'apps/api/dist'],
	['apps/web', 'apps/web'],
	['apps/web/src', 'apps/web/src'],
	// Test descriptions referencing legacy filenames.
	['orders.ts', 'orders.ts'],
	['payments.ts', 'payments.ts'],
	['admin.ts', 'admin.ts'],
	['auth.ts', 'auth.ts'],
	['auth-2fa.ts', 'auth-2fa.ts'],
	['catalog.ts', 'catalog.ts'],
	['messages.ts', 'messages.ts'],
	['refunds.ts', 'refunds.ts'],
	['reviews.ts', 'reviews.ts'],
	['wishlist.ts', 'wishlist.ts'],
	['seller.ts', 'seller.ts'],
	['notifications.ts', 'notifications.ts'],
	['coupons.ts', 'coupons.ts'],
	['shipping.ts', 'shipping.ts'],
	['cart.ts', 'cart.ts'],
	['store-followers.ts', 'store-followers.ts'],
	['addresses.ts', 'addresses.ts'],
	['totp.ts', 'totp.ts'],
	['backup-codes.ts', 'backup-codes.ts'],
	['partial-token.ts', 'partial-token.ts'],
	['reset-token.ts', 'reset-token.ts'],
	['shared.ts', 'shared.ts'],
	['middleware.ts', 'middleware.ts'],
	['dispatcher.ts', 'dispatcher.ts'],
	['search.ts', 'search.ts'],
	['pg-wrapper.ts', 'pg-wrapper.ts'],
	['validation.ts', 'validation.ts'],
	['audit.ts', 'audit.ts'],
	['error-codes.ts', 'error-codes.ts'],
	['settings.ts', 'settings.ts'],
	['settings-validation.ts', 'settings-validation.ts'],
	['json.ts', 'json.ts'],
	['sql-helpers.ts', 'sql-helpers.ts'],
	['stripe.ts', 'stripe.ts'],
	['paymob.ts', 'paymob.ts'],
	['stub.ts', 'stub.ts'],
	['routes.ts', 'routes.ts'],
	['lib.ts', 'lib.ts'],
];

function walk(dir, out = []) {
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (SKIP_DIRS.has(entry.name)) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (TEXT_EXT.has(path.extname(entry.name))) out.push(full);
	}
	return out;
}

function applyReplacements(text) {
	let out = text;
	let substitutions = 0;
	for (const [from, to] of REPLACEMENTS) {
		if (!out.includes(from)) continue;
		const parts = out.split(from);
		const count = parts.length - 1;
		substitutions += count;
		out = parts.join(to);
	}
	return { text: out, substitutions };
}

const files = walk(REPO);
let totalChanged = 0;
let totalSubs = 0;
for (const f of files) {
	const src = fs.readFileSync(f, 'utf8');
	const { text, substitutions } = applyReplacements(src);
	if (substitutions === 0) continue;
	fs.writeFileSync(f, text, 'utf8');
	totalChanged += 1;
	totalSubs += substitutions;
	console.log(`[rewrite] ${path.relative(REPO, f)}  (${substitutions} substitution${substitutions === 1 ? '' : 's'})`);
}
console.log(`\nDone. ${totalChanged} file(s) updated, ${totalSubs} substitution(s) total.`);