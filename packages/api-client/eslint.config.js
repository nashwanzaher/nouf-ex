// ESLint config for the @noufex/api-client workspace.
// Mirrors the apps/api config but with vitest globals for tests.
import baseConfig from '@noufex/eslint-config';

export default [
	...baseConfig,
	{
		files: ['tests/**/*'],
		languageOptions: {
			globals: {
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				vi: 'readonly',
			},
		},
	},
];