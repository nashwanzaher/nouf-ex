// Vitest root configuration for the top-level `scripts/` package.
// Runs pure-function tests (no DB, no API server). DB-bound tests
// live in apps/api/src/tests/.
//
// Authored as a standalone config (not a workspace) so the
// `tsx scripts/bootstrap-admin.ts` CLI is independent of any API
// workspace setup.

import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['**/*.test.ts'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		environment: 'node',
	},
});