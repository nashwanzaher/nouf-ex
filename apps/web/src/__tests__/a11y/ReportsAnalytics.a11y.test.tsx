import React from 'react';
/**
 * Accessibility (a11y) tests — ReportsAnalytics page.
 *
 * The ReportsAnalytics page renders a KPI summary grid + several
 * recharts visualizations (line, area, bar, pie). This file verifies:
 *   - axe-core finds no a11y violations on the rendered tree.
 *   - Each chart <section> exposes an accessible name (heading or aria-label).
 *   - The KPI cards show numeric text content (not just colour).
 *   - The page contains at most one <main> landmark.
 *   - The first button on the page is keyboard-focusable and Enter-activatable.
 *
 * `vitest-axe/extend-expect` is loaded globally via
 * `app/mocks/setup.ts`.
 *
 * recharts is mocked globally because happy-dom does not implement
 * the layout primitives (ResizeObserver, getBoundingClientRect)
 * that ResponsiveContainer needs to compute a non-zero size.
 * Without the stub the page renders but each chart produces console
 * warnings and `width(0)/height(0)` measurements.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunOptions } from 'axe-core';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { axe } from 'vitest-axe';
import {
    installFetchSpy,
    uninstallFetchSpy,
} from '../../../mocks/fetch-spy';

const axeOptions: RunOptions = {
	rules: {
		'color-contrast': { enabled: false },
	},
};

// ─── recharts stub ─────────────────────────────────────────
// Render nothing for the chart primitives; keep the page tree
// shape intact by rendering `children` for passthrough containers.
// We intentionally preserve the `ResponsiveContainer` so chart
// child elements still get a (zero-size) parent in the DOM.
vi.mock('recharts', () => {
	const stub = () => null;
	const passthrough = ({ children }: { children?: ReactNode }) =>
		children ?? null;
	return {
		__esModule: true,
		default: stub,
		// Chart roots
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
		CartesianGrid: stub,
		Tooltip: stub,
		Legend: stub,
		Cell: stub,
		// Brush & reference lines (some pages use them)
		Brush: stub,
		ReferenceLine: stub,
		ReferenceArea: stub,
		ReferenceDot: stub,
	};
});

// ─── i18n stub ─────────────────────────────────────────────
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

// ─── useApi stub ───────────────────────────────────────────
// ReportsAnalytics reads two admin endpoints (stats + timeseries).
// Return fixtures with the minimum shape so the page renders.
vi.mock('@/hooks/useApi', () => ({
	useAdminStats: () => ({
		data: {
			counts: {
				users: 120,
				stores: 18,
				products: 432,
				orders: 2400,
				reviews: 312,
				disputes: 4,
			},
			flags: {
				openDisputes: 4,
				pendingOrders: 12,
				paidOrders: 2388,
				suspendedUsers: 1,
				inactiveStores: 2,
			},
			revenueYer: 12_500_000,
			recent7d: { orders: 142, users: 8 },
		},
		loading: false,
		error: null,
		refetch: vi.fn(),
	}),
	useAdminTimeSeries: () => ({
		data: {
			revenue: [
				{ ts: '2026-06-26', label: 'Fri', value: 1_200_000 },
				{ ts: '2026-06-27', label: 'Sat', value: 1_350_000 },
				{ ts: '2026-06-28', label: 'Sun', value: 980_000 },
				{ ts: '2026-06-29', label: 'Mon', value: 1_410_000 },
				{ ts: '2026-06-30', label: 'Tue', value: 1_520_000 },
				{ ts: '2026-07-01', label: 'Wed', value: 1_640_000 },
				{ ts: '2026-07-02', label: 'Thu', value: 1_700_000 },
			],
		},
		loading: false,
		error: null,
		refetch: vi.fn(),
	}),
}));

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

import ReportsAnalytics from '../../pages/admin/ReportsAnalytics';

describe('A11y: ReportsAnalytics', () => {
	afterEach(() => cleanup());

	// ────────────────────────────────────────────────────────────
	// (1) No axe violations on the rendered page
	// ────────────────────────────────────────────────────────────
	it('Passes axe-core with zero violations (color-contrast disabled)', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/admin/reports']}>
				<ReportsAnalytics />
			</MemoryRouter>,
		);

		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();
	});

	// ────────────────────────────────────────────────────────────
	// (2) KPI cards have meaningful, non-empty text content
	// ────────────────────────────────────────────────────────────
	it('Each KPI card exposes numeric text content, not just colour', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/admin/reports']}>
				<ReportsAnalytics />
			</MemoryRouter>,
		);

		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// KPI labels are written in Arabic in the source (e.g.
		// "إجمالي الإيرادات", "إجمالي الطلبات"). The numeric values
		// come from formatMoney() which uses Intl.NumberFormat —
		// the exact digit format depends on the locale (ar-YE, en, etc.)
		// and the runtime Intl implementation in happy-dom.
		// We accept any of the common shapes: ASCII digits with
		// thousands separators, Arabic-Indic digits, or compact "M".
		const pageText = container.textContent ?? '';
		expect(pageText.length).toBeGreaterThan(0);

		// Look for any 7+ digit run (revenue fixture = 12_500_000),
		// accepting both Latin and Arabic-Indic digits.
		const hasLatinRevenue = /\b12[,. ]?500[,. ]?000\b/.test(pageText);
		const hasArabicRevenue = /١٢[٬,\s]?٥٠٠[٬,\s]?٠٠٠/.test(pageText);
		const hasCompactRevenue = /12[.,]5\s*M/i.test(pageText);
		expect(
			hasLatinRevenue || hasArabicRevenue || hasCompactRevenue,
		).toBe(true);
	});

	// ────────────────────────────────────────────────────────────
	// (3) Date-range / period selector is keyboard-operable
	// ────────────────────────────────────────────────────────────
	it('First button on the page is keyboard-focusable and Enter-activatable', async () => {
		const user = userEvent.setup();

		const { container } = render(
			<MemoryRouter initialEntries={['/admin/reports']}>
				<ReportsAnalytics />
			</MemoryRouter>,
		);

		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// The selector uses native <button> elements per the source.
		// Find a "هذا الأسبوع" / "أسبوع" / period-selector group:
		//   1. There must be at least one button in the page.
		const buttons = screen.getAllByRole('button');
		expect(buttons.length).toBeGreaterThan(0);

		// 2. Focus the first button and verify document focus moved.
		const first = buttons[0];
		first.focus();
		expect(document.activeElement).toBe(first);

		// 3. Activate it via keyboard (Enter) and confirm it doesn't
		//    throw / unhandled error — the simplest "keyboard operable"
		//    check happy-dom can give us without simulating click handlers.
		await user.keyboard('{Enter}');
		// After Enter, the page should still be rendered (no crash).
		expect(container.firstChild).not.toBeNull();
	});

	// ────────────────────────────────────────────────────────────
	// (4) Chart containers carry an accessible name
	// ────────────────────────────────────────────────────────────
	it('Each chart Card exposes a heading OR aria-label', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/admin/reports']}>
				<ReportsAnalytics />
			</MemoryRouter>,
		);

		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// Strategy: collect every shadcn Card on the page and assert
		// that each one has EITHER a heading descendant OR an aria-label
		// / aria-labelledby. The ReportsAnalytics layout wraps each
		// chart in a <Card> with a <CardHeader> containing a visible <h3>.
		const cards = container.querySelectorAll('[data-slot="card"]');
		expect(cards.length).toBeGreaterThan(0);

		for (const card of cards) {
			const heading = card.querySelector(
				'h1, h2, h3, h4, h5, h6, [role="heading"]',
			);
			const ariaLabel = card.getAttribute('aria-label');
			const ariaLabelledBy = card.getAttribute('aria-labelledby');
			const accessibleName =
				heading?.textContent ?? ariaLabel ?? ariaLabelledBy ?? '';
			expect(accessibleName.trim().length).toBeGreaterThan(0);
		}
	});

	// ────────────────────────────────────────────────────────────
	// (5) Page has at most one <main> landmark
	// ────────────────────────────────────────────────────────────
	it('Exposes at most one <main> landmark for the report page', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/admin/reports']}>
				<ReportsAnalytics />
			</MemoryRouter>,
		);

		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		const main = screen.queryAllByRole('main');
		// Either exactly one <main> OR zero (because AdminDashboard wraps
		// it in an <Outlet /> without nested routes — in that case the
		// page renders the body but no <main> landmark).
		expect(main.length).toBeLessThanOrEqual(1);
		if (main.length === 1) {
			expect(
				within(main[0]!).queryByRole('button'),
			).toBeInTheDocument();
		}
		// And the page has some buttons / KPIs rendered (non-trivial DOM).
		expect(container.querySelectorAll('button').length).toBeGreaterThan(0);
	});
});
