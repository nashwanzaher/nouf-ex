import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { inspectAttr } from 'plugin-inspect-react-code';

// https://vite.dev/config/
//
// PWA configuration: progressive web app with offline support via Workbox.
// - registerType: 'autoUpdate' — the new SW takes over on next page load.
// - workbox precaches all static assets, routes navigations through the SPA
//   shell, and provides a NetworkFirst fallback for the API.
// - The manifest ships inline; the icons live in /public and are
//   referenced by relative URL.
export default defineConfig({
	base: './',
	plugins: [
		inspectAttr(),
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['noufex-logo.svg', 'favicon.ico'],
			manifest: {
				name: 'Nouf-ex — Yemen Marketplace',
				short_name: 'Nouf-ex',
				description:
					'B2B/B2C marketplace connecting Yemeni merchants and customers (Alibaba/Taobao-inspired).',
				theme_color: '#0d9488',
				background_color: '#ffffff',
				display: 'standalone',
				orientation: 'any',
				lang: 'ar',
				dir: 'rtl',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: '/noufex-logo.svg',
						sizes: '192x192',
						type: 'image/svg+xml',
						purpose: 'any',
					},
					{
						src: '/noufex-logo.svg',
						sizes: '512x512',
						type: 'image/svg+xml',
						purpose: 'maskable',
					},
				],
				categories: ['shopping', 'business'],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,woff,woff2}'],
				// Bump precache limit above the 2 MiB default — hero/showcase PNGs
				// and other marketing assets can easily exceed that.
				maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
				// SPA routing: any navigation that doesn't match a precached file
				// falls back to /index.html (the React Router entry point).
				navigateFallback: '/index.html',
				// API requests are always sent to the network — never cache stale
				// product data. Failed requests fall back to a small offline page.
				navigateFallbackDenylist: [/^\/api\//],
				runtimeCaching: [
					{
						urlPattern: ({ request }) => request.destination === 'document',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'noufex-pages',
							networkTimeoutSeconds: 3,
						},
					},
					{
						urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
						handler: 'CacheFirst',
						options: {
							cacheName: 'noufex-assets',
							// 30 days in seconds (Workbox expects a number)
							expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
						},
					},
					{
						urlPattern: ({ url }) =>
							url.pathname.startsWith('/products/') ||
							url.pathname.endsWith('.jpg') ||
							url.pathname.endsWith('.png') ||
							url.pathname.endsWith('.webp'),
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'noufex-images',
							// 7 days in seconds (Workbox expects a number)
							expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
						},
					},
				],
			},
			devOptions: {
				// Don't enable the SW in dev — it confuses Vite HMR.
				enabled: false,
			},
		}),
	],
	server: {
		port: 3000,
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
});
