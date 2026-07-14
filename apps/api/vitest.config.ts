import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// API tests need access to DATABASE_URL + AUTH_SECRET from the repo-root
// `.env`. Vitest doesn't auto-load dotenv, so we wire it up here once.
// The repo root is two levels up from `apps/api/`.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

// Load .env eagerly so `lib/shared.ts` (which throws at module-load if
// DATABASE_URL is missing) never sees a process.env without it.
import('dotenv').then((dotenv) => {
	dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });
});

// `setupFiles` re-applies the same dotenv load synchronously before
// any test file is imported. This is the only reliable place where
// `process.env.DATABASE_URL` is guaranteed to be populated before the
// modules under test run their top-level await / side-effects.
export default defineConfig({
	test: {
		globals: true,
		testTimeout: 20_000,
		hookTimeout: 20_000,
		setupFiles: [path.resolve(__dirname, 'vitest.setup.ts')],
	},
});
