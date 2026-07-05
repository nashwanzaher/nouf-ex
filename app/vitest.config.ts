/// <reference types="vitest" />
// Vitest root configuration for the Nouf-ex app.
//
// Two projects (declared inline so Vitest 4 picks them up reliably):
//   - `server`: tests run in `node` (no DOM globals).
//   - `dom`:    tests run in `happy-dom` (for components / hooks / context).
//
// Shared options live at the top level. Each project overrides the bits
// it needs (include pattern, environment).
//
// Note: Vitest 4 deprecated the standalone `vitest.workspace.ts` file
// mechanism in favor of inline `projects` here. The projects array is the
// supported, recommended approach.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Vitest 4 + Vite 7 run vitest.config.ts in ESM mode, where `__dirname`
// is undefined. We derive the directory of THIS file from `import.meta.url`
// so the alias resolves to a stable absolute path under all module systems.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	test: {
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json-summary'],
			reportsDirectory: './coverage',
			include: [
				'src/lib/**/*.{ts,tsx}',
				'src/hooks/**/*.{ts,tsx}',
				'src/context/**/*.{ts,tsx}',
				'src/components/**/*.{ts,tsx}',
				'server/**/*.ts',
				'server/**/*.cts',
			],
			exclude: [
				// Test files themselves
				'src/**/*.test.{ts,tsx}',
				'src/**/__tests__/**',
				'server/tests/**',
				// Generated bundle artifacts — esbuild compiles
				// server/index.ts to server/index.{js,cjs}. These are
				// build outputs, not authored code, and including them
				// drags the coverage denominator down to ~16%. The
				// real source files (.ts / .cts above) still count.
				'server/index.js',
				'server/index.cjs',
				'server/index.ts', // entry; exercised by integration tests
				// 3rd-party + Vite scaffolding
				'src/components/ui/**',
				'node_modules/**',
				'dist/**',
				'coverage/**',
			],
			// Per MIGRATION_EXECUTION_PLAN.md §30 R-4 (v2.7.5) and ADR-0005
			// approved Round-9 prioritized roadmap. Thresholds set just
			// below the measured baseline (per Round-3 §11.3 audit:
			// Lines ~52.48%, Functions ~57.3%) so the gate enforces
			// regression prevention without flapping.
			thresholds: {
				lines: 50,
				statements: 50,
				functions: 55,
				branches: 45,
			},
		},
		testTimeout: 20_000,
		hookTimeout: 20_000,
		projects: [
			{
				resolve: {
					alias: {
						'@': path.resolve(__dirname, './src'),
					},
				},
				// Treat `.cts` (CommonJS TypeScript) as TS so the
				// server-only pg-wrapper is parseable by the test
				// bundler. Without this, vitest's rollup plugin
				// passes the file to a JS parser and chokes on
				// the `function foo(): T` return-type annotation.
				esbuild: {
					loader: 'tsx',
					include: [/server\/.*\.[mc]?[jt]sx?$/],
				},
				test: {
					name: 'server',
					environment: 'node',
					setupFiles: [path.resolve(__dirname, 'tests/setup.ts')],
					include: [
						'tests/**/*.test.{js,ts,tsx,cjs,mjs}',
						'server/tests/**/*.test.{js,ts,tsx,cjs,mjs}',
					],
				},
			},
			{
				resolve: {
					alias: {
						'@': path.resolve(__dirname, './src'),
					},
				},
				test: {
					name: 'dom',
					environment: 'happy-dom',
					setupFiles: [path.resolve(__dirname, 'tests/setup.ts')],
					include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
				},
			},
		],
	},
});
