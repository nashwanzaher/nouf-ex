/**
 * Test bootstrap — runs before every test file.
 *
 * - Loads .env so tests that read DATABASE_URL get the real value.
 * - Configures test-only env defaults (PORT=0 → pick a free port).
 * - Stubs the `pg` module so unit tests can run without a live database.
 *   The factory below is invoked lazily, the first time `pg` is imported,
 *   so `vi` is fully initialized by the time it runs.
 * - Conditionally loads jest-dom matchers when a DOM environment is in use.
 */

import { config as loadDotenv } from 'dotenv';
import { vi } from 'vitest';

loadDotenv({ path: '.env.test', quiet: true });
loadDotenv({ path: '.env', quiet: true });

// Test-wide defaults
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '0';
// The API server requires a DATABASE_URL at module load. Tests mock the `pg`
// driver globally so the value is never actually used, but we still need a
// syntactically valid URL for the server module to import without throwing.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:test@localhost:5432/test';

// jest-dom matchers are DOM-only. They augment expect() globally; if we
// load them in node env the matchers themselves are no-ops so it's safe.
if (typeof document !== 'undefined') {
	await import('@testing-library/jest-dom/vitest');
}

// ── Global `pg` mock ──────────────────────────────────────────────────────────
// The factory runs only when `pg` (or a module that imports it) is first
// loaded by a test. At that point `vi` is fully initialized, so we can
// construct fresh vi.fn()-backed methods on each `new Pool()` call.
vi.mock('pg', () => ({
	Pool: vi.fn().mockImplementation(() => ({
		query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
		connect: vi.fn().mockResolvedValue({
			query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
			release: vi.fn(),
		}),
		end: vi.fn().mockResolvedValue(undefined),
	})),
}));
