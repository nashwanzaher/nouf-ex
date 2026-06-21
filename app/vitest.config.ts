/// <reference types="vitest" />
// Vitest configuration for the Nouf-ex app.
//
// Three environments, switched by path glob:
//   - happy-dom: files under src/**/__tests__/ (components + hooks + context)
//   - node:      files under app/server/tests/  (API + schema)
//   - node:      files under app/tests/mocks/   (MSW handlers + fixtures)
//
// The single global setup file (`tests/setup.ts`) loads .env and stubs the
// `pg` driver so neither side needs a live database.

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	test: {
		globals: true,
		environment: 'node',
		include: [
			'tests/**/*.test.{js,ts,tsx,cjs,mjs}',
			'src/**/__tests__/**/*.test.{ts,tsx}',
			'server/tests/**/*.test.{js,ts,tsx,cjs,mjs}',
		],
		environmentMatchGlobs: [
			// Component / hook / context tests need DOM globals.
			['src/**/__tests__/**/*.test.{ts,tsx}', 'happy-dom'],
		],
		setupFiles: ['./tests/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json-summary'],
			reportsDirectory: './coverage',
			include: [
				'src/lib/**/*.{ts,tsx,cjs,mjs}',
				'src/hooks/**/*.{ts,tsx}',
				'src/context/**/*.{ts,tsx}',
				'src/components/**/*.{ts,tsx}',
				'server/**/*.{ts,tsx,cjs,mjs}',
			],
			exclude: [
				'src/**/*.test.{ts,tsx,cjs,mjs}',
				'src/**/__tests__/**',
				'src/components/ui/**',
				'server/tests/**',
				'node_modules/**',
			],
		},
		testTimeout: 20_000,
		hookTimeout: 20_000,
	},
});
