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
	// base '/' (absolute) is required for deep-link SPA routes like
	// /auth/login to work after a full-page reload. With the previous
	// base: './' the served index.html referenced `./assets/index-...js`,
	// which the browser resolved to `/auth/assets/...` when the entry
	// URL was /auth/login — the static middleware then returned the SPA
	// fallback HTML with `text/html` MIME, causing every JS module to
	// fail to load. Absolute paths fix this without changing the
	// production bundle's byte size.
	base: '/',
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
				// NOTE: HTML is intentionally excluded from the precache.
				// The server injects a per-request CSP nonce into the
				// index.html shell, so serving a cached (non-nonced)
				// copy would break every script on a hard navigation.
				// JS/CSS/SVG/font/image assets are versioned by their
				// hashed filename and are safe to precache forever.
				globPatterns: ['**/*.{js,css,svg,png,jpg,webp,woff,woff2}'],
				// Bump precache limit above the 2 MiB default — hero/showcase PNGs
				// and other marketing assets can easily exceed that.
				maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
				// SPA routing: any navigation that doesn't match a precached file
				// falls back to the network (see the document runtime-cache
				// rule below). We do NOT precache or name a static
				// navigateFallback file because the server injects a
				// per-request CSP nonce into the SPA shell.
				navigateFallback: null,
				// API requests are always sent to the network — never cache stale
				// product data. Failed requests fall back to a small offline page.
				navigateFallbackDenylist: [/^\/api\//],
				runtimeCaching: [
					{
						// HTML documents — always go to the network first
						// because the server injects a per-request CSP
						// nonce into index.html. Caching the SPA shell
						// would break the nonce. The handler keeps the
						// response unpushed into the cache (we use
						// `expiration.maxEntries: 0` to disable cache
						// writes for this rule entirely — Workbox will
						// still return the live network response and
						// never serve a stale copy on a hard reload).
						urlPattern: ({ request }) => request.destination === 'document',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'noufex-pages',
							networkTimeoutSeconds: 3,
							expiration: { maxEntries: 0, maxAgeSeconds: 0 },
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
		// Proxy /api requests to the running Nouf-ex container (port 3000).
		// The container is the canonical API host in dev too: it has the
		// real `noufex_db` connection and the real seed data, so dev work
		// hits the same data the production app sees. Vite's own port
		// (3000) auto-increments to 3001/5173/... when 3000 is in use.
		// When the container is stopped, set `API_PORT` to 3000 and run
		// `npm run api` to use tsx directly — this proxy will still work.
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: false,
			},
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	build: {
		// P2-2 fix: split the main bundle into vendor + framework chunks
		// so heavy libraries (recharts, framer-motion, gsap, the
		// radix-ui primitives, lucide icons) are cached separately and
		// can be served in parallel by the browser. The previous
		// single 1.4 MB chunk blocked first paint and forced a fresh
		// download for every code change.
		rollupOptions: {
			output: {
				manualChunks: {
					// React + react-dom + react-router share a chunk
					react: ['react', 'react-dom', 'react-router'],
					// Recharts (charting) is ~250 kB on its own
					recharts: ['recharts'],
					// PERF-H4 (2026-07-02): animation libraries were
					// bundled together. gsap is used by 9 Home/*
					// subcomponents; framer-motion is used by Toast,
					// DashboardShell, SellerOrders, SellerProducts.
					// They never load together. Splitting them drops
					// ~50 kB gz off the Home bundle and ~40 kB gz off
					// the seller bundle.
					framer: ['framer-motion'],
					gsap: ['gsap', '@gsap/react'],
					// All 28 @radix-ui/* packages → one chunk
					'radix-ui': [
						'@radix-ui/react-accordion',
						'@radix-ui/react-alert-dialog',
						'@radix-ui/react-aspect-ratio',
						'@radix-ui/react-avatar',
						'@radix-ui/react-checkbox',
						'@radix-ui/react-collapsible',
						'@radix-ui/react-context-menu',
						'@radix-ui/react-dialog',
						'@radix-ui/react-dropdown-menu',
						'@radix-ui/react-hover-card',
						'@radix-ui/react-label',
						'@radix-ui/react-menubar',
						'@radix-ui/react-navigation-menu',
						'@radix-ui/react-popover',
						'@radix-ui/react-progress',
						'@radix-ui/react-radio-group',
						'@radix-ui/react-scroll-area',
						'@radix-ui/react-select',
						'@radix-ui/react-separator',
						'@radix-ui/react-slider',
						'@radix-ui/react-slot',
						'@radix-ui/react-switch',
						'@radix-ui/react-tabs',
						'@radix-ui/react-toggle',
						'@radix-ui/react-toggle-group',
						'@radix-ui/react-tooltip',
					],
					// PERF-H6 (2026-07-02): REMOVED `lucide: ['lucide-react']`.
					// Listing the module as a manual-chunk entry
					// FORCES Rollup to put the entire barrel — every
					// icon, ~300 kB — into one chunk. With no entry,
					// Rollup tree-shakes the actual imports, leaving
					// only the icons each page uses. This typically
					// saves 100-200 kB gz on the Home bundle.
					// Date / time helpers
					dates: ['date-fns', 'react-day-picker'],
				},
			},
		},
		// Raise the chunk-size warning since some of these are
		// necessarily large (recharts alone is ~250 kB minified).
		chunkSizeWarningLimit: 800,
	},
});
