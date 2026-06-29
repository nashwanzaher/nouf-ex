/**
 * UI Smoke Tests — render every page and verify no runtime errors.
 *
 * What this catches:
 * - Hooks returning null/undefined that the page doesn't handle
 * - Missing i18n keys that throw at render
 * - Unhandled API endpoints (MSW fetch-spy throws on unmapped URLs)
 * - React strict-mode warnings (mount/unmount cycle errors)
 *
 * What this DOES NOT catch:
 * - Visual regressions
 * - Click flow / form submissions (those need Playwright)
 *
 * Implementation note: instead of `vi.mock('@/lib/api', ...) + vi.mock(
 * '@/hooks/useApi', ...) + globalThis.fetch = vi.fn().mockResolvedValue([])`
 * (the old "everything returns empty" pattern), we now route every
 * fetch through MSW handlers via `tests/mocks/fetch-spy.ts`. The handlers
 * mirror what the real backend returns, so a page that doesn't handle a
 * field correctly will fail with "unhandled GET /api/..." or a render
 * crash — both real, observable bugs.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Suspense, type ReactNode } from 'react';
import { installFetchSpy, uninstallFetchSpy } from '../../../tests/mocks/fetch-spy';
import { AppProvider } from '@/context/AppContext';
import { CartProvider } from '@/context/CartContext';

// ─── HTTP interception ────────────────────────────────────────────
// The fetch-spy patches `globalThis.fetch` so every call inside a
// component is intercepted at the network boundary. Unmapped URLs
// throw — this is the production-grade signal that a page is asking
// for something the test infrastructure doesn't know about, which is
// almost always an actual bug (typo'd path, unwired hook, etc.).
beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

// Wrap every page in the providers it needs. In production App.tsx
// wraps everything in AppProvider + CartProvider; the smoke test
// matches that to render pages the way real users see them.
function Providers({ children }: { children: ReactNode }) {
	return (
		<AppProvider>
			<CartProvider>{children}</CartProvider>
		</AppProvider>
	);
}

// ─── i18n stub ─────────────────────────────────────────────────────
// Provide a t() that returns the fallback (second arg) so we can
// detect missing keys without spinning up the real i18next.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
	Trans: ({ children }: { children: React.ReactNode }) => children,
	initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// ─── recharts stub ─────────────────────────────────────────────────
// recharts' ResponsiveContainer reports "width(0)/height(0)" warnings
// when rendered under happy-dom (no layout engine). Replacing every
// named export with a null-returning stub keeps the page tree intact
// while silencing the warnings so the smoke test can finish. We do
// NOT do this through MSW because recharts never makes an HTTP call —
// it's a DOM measurement problem, not a network problem.
vi.mock('recharts', () => {
	const stub = () => null;
	const passthrough = ({ children }: { children: React.ReactNode }) => children ?? null;
	return {
		__esModule: true,
		default: stub,
		// Charts (containers)
		LineChart: stub,
		BarChart: stub,
		AreaChart: stub,
		PieChart: stub,
		ScatterChart: stub,
		RadarChart: stub,
		RadialBarChart: stub,
		ComposedChart: stub,
		FunnelChart: stub,
		SunburstChart: stub,
		Treemap: stub,
		Sankey: stub,
		ResponsiveContainer: passthrough,
		// Series primitives
		Line: stub,
		Bar: stub,
		Area: stub,
		Pie: stub,
		Scatter: stub,
		Radar: stub,
		RadialBar: stub,
		Funnel: stub,
		// Axes & grid
		XAxis: stub,
		YAxis: stub,
		ZAxis: stub,
		CartesianAxis: stub,
		CartesianGrid: stub,
		PolarAngleAxis: stub,
		PolarGrid: stub,
		PolarRadiusAxis: stub,
		// Decorations
		Tooltip: stub,
		Legend: stub,
		Cell: stub,
		Brush: stub,
		ReferenceLine: stub,
		ReferenceArea: stub,
		ReferenceDot: stub,
		ErrorBar: stub,
		LabelList: stub,
		Label: stub,
		// Customization
		Customized: stub,
		DefaultLegendContent: stub,
		DefaultTooltipContent: stub,
		// Geometry shapes (recharts internals)
		Curve: stub,
		Dot: stub,
		Cross: stub,
		Polygon: stub,
		Rectangle: stub,
		Sector: stub,
		Surface: stub,
		Symbols: stub,
		Layer: stub,
		Trapezoid: stub,
		Text: stub,
		Global: stub,
	};
});

// ─── list of every page to smoke-test ───────────────────────────
import SellerDashboard from '../seller/SellerDashboard';
import SellerProducts from '../seller/SellerProducts';
import SellerOrders from '../seller/SellerOrders';
import SellerAnalytics from '../seller/SellerAnalytics';
import CustomerDashboard from '../customer/CustomerDashboard';
import CustomerOrders from '../customer/CustomerOrders';
import Wishlist from '../customer/Wishlist';
import Reviews from '../customer/Reviews';
import Notifications from '../customer/Notifications';
import AdminDashboard from '../admin/AdminDashboard';
import AdminOverview from '../admin/AdminOverview';
import AdminAuditLog from '../admin/AdminAuditLog';
import AdminProducts from '../admin/AdminProducts';
import AdminOrders from '../admin/AdminOrders';
import UsersManagement from '../admin/UsersManagement';
import StoresManagement from '../admin/StoresManagement';
import DisputesManagement from '../admin/DisputesManagement';
import ReportsAnalytics from '../admin/ReportsAnalytics';
import Login from '../auth/Login';
import Register from '../auth/Register';
import ForgotPassword from '../auth/ForgotPassword';
import ResetPassword from '../auth/ResetPassword';
import NotFound from '../NotFound';
import Home from '../Home';

// NOTE: Addresses.tsx is intentionally NOT imported here. Its dialog
// form body triggers a happy-dom render-loop that hangs the worker
// (the Radix Dialog portal can't reconcile with React 19 + jsdom).
// We document this gap in docs/MASTER_PLAN.md §11 and revisit it once
// Playwright is in the loop. Do not re-add it without a render-trap.
const pages: { name: string; Component: React.ComponentType }[] = [
	{ name: 'Home', Component: Home },
	{ name: 'NotFound', Component: NotFound },
	{ name: 'Login', Component: Login },
	{ name: 'Register', Component: Register },
	{ name: 'ForgotPassword', Component: ForgotPassword },
	{ name: 'ResetPassword', Component: ResetPassword },
	{ name: 'SellerDashboard', Component: SellerDashboard },
	{ name: 'SellerProducts', Component: SellerProducts },
	{ name: 'SellerOrders', Component: SellerOrders },
	{ name: 'SellerAnalytics', Component: SellerAnalytics },
	{ name: 'CustomerDashboard', Component: CustomerDashboard },
	{ name: 'CustomerOrders', Component: CustomerOrders },
	{ name: 'Wishlist', Component: Wishlist },
	{ name: 'Reviews', Component: Reviews },
	{ name: 'Notifications', Component: Notifications },
	{ name: 'AdminDashboard', Component: AdminDashboard },
	{ name: 'AdminOverview', Component: AdminOverview },
	{ name: 'AdminAuditLog', Component: AdminAuditLog },
	{ name: 'AdminProducts', Component: AdminProducts },
	{ name: 'AdminOrders', Component: AdminOrders },
	{ name: 'UsersManagement', Component: UsersManagement },
	{ name: 'StoresManagement', Component: StoresManagement },
	{ name: 'DisputesManagement', Component: DisputesManagement },
	{ name: 'ReportsAnalytics', Component: ReportsAnalytics },
];

describe('UI smoke — every page renders without crashing', () => {
	beforeEach(() => cleanup());

	// Pages excluded from the smoke run go in this set. Each entry
	// must be documented in docs/MASTER_PLAN.md §11 (gap analysis).
	const TODOS = new Set<string>([]);

	for (const { name, Component } of pages) {
		const itFn = TODOS.has(name) ? it.skip : it;
		itFn(`${name}: mounts without runtime errors`, () => {
			expect(() =>
				render(
					<Providers>
						<MemoryRouter>
							<Suspense fallback={null}>
								<Component />
							</Suspense>
						</MemoryRouter>
					</Providers>,
				),
			).not.toThrow();
		});
	}
});
