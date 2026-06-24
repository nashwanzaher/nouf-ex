import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
	globalIgnores(['dist', 'node_modules', 'coverage', '**/*.cjs']),
	{
		// Frontend + scripts: TS/TSX (React) + JS/CJS (Node tooling).
		files: ['**/*.{ts,tsx}'],
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
		],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
		},
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
		},
	},
	// ── Server (.cts) ────────────────────────────────────────────────────────
	// Same TS rules as the frontend block, but NO react-refresh (Express code
	// is never a React component) and Node globals instead of browser globals.
	// Without this block, every server file is silently skipped by `eslint .`
	// (ESLint's default extension list does not include `.cts`), so a
	// broken import or unused var in `server/lib/*.cts` would slip past CI.
	{
		files: ['server/**/*.{ts,cts}'],
		extends: [js.configs.recommended, tseslint.configs.recommended],
		languageOptions: {
			ecmaVersion: 2022,
			globals: { ...globals.node, ...globals.browser },
			sourceType: 'module',
		},
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
		},
	},
	// shadcn/ui convention: components in src/components/ui co-export cva variants and
	// tiny primitive constants for ergonomic consumption. Disabling the rule here is the
	// official shadcn recommendation, not a workaround.
	{
		files: ['src/components/ui/**/*.{ts,tsx}'],
		rules: {
			'react-refresh/only-export-components': 'off',
		},
	},
	// Context modules legitimately expose a Provider component alongside the useX() hook.
	// The hook is the public API and must live next to its provider for tree-shaking.
	{
		files: ['src/context/**/*.{ts,tsx}'],
		rules: {
			'react-refresh/only-export-components': 'off',
		},
	},
]);
