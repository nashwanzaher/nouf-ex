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

import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
