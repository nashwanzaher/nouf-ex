/**
 * Tailwind config for NativeWind (Phase 5).
 *
 * NativeWind v4 lets us reuse Tailwind utility classes in React
 * Native. The theme mirrors the web app so the look is consistent
 * across web and mobile.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		'./src/app/**/*.{js,jsx,ts,tsx}',
		'./src/features/**/*.{js,jsx,ts,tsx}',
		'./src/components/**/*.{js,jsx,ts,tsx}',
	],
	presets: [require('nativewind/preset')],
	theme: {
		extend: {
			colors: {
				primary: {
					50: '#f0fdfa',
					100: '#ccfbf1',
					500: '#14b8a6',
					600: '#0d9488',
					700: '#0f766e',
				},
			},
		},
	},
	plugins: [],
};