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

console.log('[setup.ts] running, cwd=', process.cwd());

// Load .env from the project ROOT (one level up from app/), not the cwd,
// because tests run with app/ as cwd but .env lives in the repo root.
loadDotenv({ path: '../.env', quiet: true });

console.log('[setup.ts] after dotenv: DATABASE_URL=', process.env.DATABASE_URL ? 'set' : 'MISSING');

// Test-wide defaults
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '0';
// The API server requires a DATABASE_URL at module load. Tests mock the `pg`
// driver globally so the value is never actually used, but we still need a
// syntactically valid URL for the server module to import without throwing.
process.env.DATABASE_URL =
	process.env.DATABASE_URL ?? 'postgresql://postgres:test@localhost:5432/test';

console.log('[setup.ts] final: DATABASE_URL=', process.env.DATABASE_URL ? 'set' : 'MISSING');

// jest-dom matchers are DOM-only but safe to load in any environment —
// they extend `expect()` globally and the matchers themselves are no-ops
// when DOM globals are absent (e.g. in the `server` project). Loading them
// unconditionally avoids the brittle `typeof document` check (which would
// fail in the DOM project too, because setup.ts runs before happy-dom
// installs the `document` global).
await import('@testing-library/jest-dom/vitest');

// ── Global `pg` mock ──────────────────────────────────────────────────────────
// The factory runs only when `pg` (or a module that imports it) is first
// loaded by a test. At that point `vi` is fully initialized, so we can
// construct fresh vi.fn()-backed methods on each `new Pool()` call.
//
// R4 fix: `Pool` is instantiated with `new Pool(config)` in
// `pg-wrapper.cts`, so the mock must be a constructible function. A
// plain `vi.fn().mockImplementation(() => obj)` is callable but NOT
// constructible (calling it with `new` throws "is not a constructor").
// We return a constructor-shaped function that supports both call styles
// (callable with `new` AND callable as a function), with fresh `vi.fn()`
// spies on every instantiation.
//
// We use `Object.assign` on a fresh object instead of writing `this.x =`
// to avoid TypeScript's `this`-typing being parsed as a class field
// (esbuild inside the mock factory sees the colon and chokes).
vi.mock('pg', () => ({
	/**
	 * Mock of the `pg` Pool. Must be constructible (`new Pool(config)`)
	 * AND callable (some libs invoke without `new`). esbuild parses
	 * the body as raw JS, so we MUST NOT add a TypeScript type
	 * annotation on `_config` — esbuild hits the `:` and complains.
	 * TypeScript's noImplicitAny warning is silenced with a directive
	 * comment that esbuild ignores.
	 *
	 * @param {any} _config pg Pool config; unused in the mock.
	 */
	// @ts-expect-error -- noImplicitAny; see JSDoc above.
	Pool: function PoolMock(_config) {
		// `new` will pass a new object as `this`; we mutate it in place.
		// `Reflect.construct` would be cleaner but isn't necessary here.
		// Note: NO type annotations inside this factory body — esbuild parses
		// it as raw JS and chokes on the `:` of `: unknown` etc.
		const self = this === undefined ? {} : this;
		Object.assign(self, {
			query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
			connect: vi.fn().mockResolvedValue({
				query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
				release: vi.fn(),
			}),
			end: vi.fn().mockResolvedValue(undefined),
		});
		return self;
	},
}));
