import React from 'react';
/**
 * Accessibility (a11y) tests — vitest-axe + Testing Library.
 *
 * P2-09: integrates `vitest-axe` (the vitest-native wrapper around
 * axe-core) so the a11y attributes added in commit bc7f71f are
 * verified by an automated test on every CI run.
 *
 * What this test catches that the smoke test cannot:
 *   - axe-core rule violations (color contrast on color-only status,
 *     landmark structure, label/name mismatches, etc.)
 *   - Regressions of the explicit a11y attributes:
 *       * `OrderTimeline`  →  role="list" + role="listitem" +
 *                             aria-current="step" on the active step
 *       * `StatusBadge`    →  role="status" with a localized aria-label
 *       * `AdminDashboard` →  aria-current="page" on the active sidebar
 *                             link (the rest of the page is a layout shell
 *                             with <Outlet />, which renders nothing under
 *                             MemoryRouter without nested routes — that's
 *                             fine for this test, we only care about the
 *                             sidebar nav)
 *
 * Mocking strategy
 * ----------------
 * We render each component directly (not through <App />) so we can:
 *   - skip the lazy-import + ProtectedRoute + Layout pipeline,
 *   - keep each test independent of fetch / auth state.
 *
 * The mocks below are intentionally minimal:
 *   - `react-i18next`  →  t(key, fallback) returns the fallback.
 *   - `@/hooks/useApi` →  returns ONE shipped order so the timeline
 *                         renders 4 listitems and the status badge
 *                         renders exactly one element with role=status.
 *   - `@/context/AppContext.useAuth` →  returns a hard-coded admin
 *                         user; AdminDashboard reads `user?.name ?? email`
 *                         for the avatar initial, nothing more.
 *
 * The fetch-spy is installed as a safety net in case any descendant
 * component (e.g. an icon-list widget) tries to hit the network; in
 * practice none of the mocked surfaces do, so it's a no-op here.
 *
 * Note on color-contrast
 * ----------------------
 * We disable axe-core's `color-contrast` rule here. Two reasons:
 *   1. happy-dom's CSS engine does not compute the runtime contrast
 *      ratios axe-core needs, so the check returns noise on every page.
 *   2. The dashboard's status palette (e.g. #FF9800 on white) was
 *      inherited from the legacy design and is tracked separately as
 *      a P2/P3 design-token follow-up — out of scope for P2-09.
 * The a11y ATTRIBUTES under test (roles, aria-labels, aria-current)
 * are independent of color contrast.
 */

import { cleanup, render, screen } from '@testing-library/react';
import type { RunOptions as AxeOptions } from 'axe-core';
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

// Shared axe options — see the file header for the rationale.
const axeOptions: AxeOptions = {
	rules: {
		'color-contrast': { enabled: false },
	},
};

// ─── i18n stub ─────────────────────────────────────────────────────
// t() returns the second arg (the English fallback) so the aria-labels
// we assert against are predictable regardless of the test locale.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

// ─── useApi stub for CustomerDashboard ─────────────────────────────
// One order with status="shipped" is enough to:
//   - render the OrderTimeline (4 listitems)
//   - render the StatusBadge (role="status")
// The fields below mirror the real Order shape used by the page; extra
// fields are omitted on purpose to keep the mock minimal.
vi.mock('@/hooks/useApi', () => ({
	useNotifications: () => ({
		data: [],
		loading: false,
		error: null,
		refetch: vi.fn(),
	}),
	useOrders: () => ({
		data: [
			{
				id: 'order-1',
				status: 'shipped',
				items: [],
				total: 12_500,
				created_at: '2026-07-01T00:00:00Z',
			},
		],
		loading: false,
		error: null,
		refetch: vi.fn(),
	}),
	useWishlistItems: () => ({
		data: [],
		loading: false,
		error: null,
		refetch: vi.fn(),
	}),
}));

// ─── useAuth stub for AdminDashboard ───────────────────────────────
// AdminDashboard only reads `user.name` / `user.email` for the avatar
// initial and the sidebar footer. No login() / logout() side-effects
// are triggered by render.
vi.mock('@/context/AppContext', () => ({
	useAuth: () => ({
		user: {
			id: 'u-admin',
			name: 'Admin User',
			email: 'admin@example.com',
			role: 'admin',
		},
		token: 'fake-test-token',
		isAuthenticated: true,
		login: vi.fn(),
		logout: vi.fn(),
	}),
}));

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

// Pages under test.
import AdminDashboard from '../admin/AdminDashboard';
import CustomerDashboard from '../customer/CustomerDashboard';

describe('Accessibility (vitest-axe)', () => {
	afterEach(() => cleanup());

	// ── (a) OrderTimeline: list semantics + 4 steps + aria-current ───
	it('CustomerDashboard.OrderTimeline: list role, 4 listitems, aria-current on active step', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/customer']}>
				<CustomerDashboard />
			</MemoryRouter>,
		);

		// 1. axe-core: no a11y violations on the rendered DOM.
		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// 2. The timeline is a labelled list.
		expect(
			screen.getByRole('list', { name: /order progress/i }),
		).toBeInTheDocument();

		// 3. Exactly 4 listitems (ordered / processing / shipped / delivered).
		const listitems = screen.getAllByRole('listitem');
		expect(listitems).toHaveLength(4);

		// 4. Exactly one of them carries aria-current="step" (the active one).
		const active = listitems.filter(
			(el) => el.getAttribute('aria-current') === 'step',
		);
		expect(active).toHaveLength(1);
	});

	// ── (b) StatusBadge: role=status + localized aria-label ────────
	it('CustomerDashboard.StatusBadge: role=status with localized aria-label', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/customer']}>
				<CustomerDashboard />
			</MemoryRouter>,
		);

		// 1. axe-core: no a11y violations on the rendered DOM.
		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// 2. At least one role="status" badge is rendered (one per order).
		const badges = screen.getAllByRole('status');
		expect(badges.length).toBeGreaterThanOrEqual(1);

		// 3. The aria-label starts with the localized "Status:" prefix.
		//    This catches regressions where someone reverts to colour-only
		//    status semantics (which fails for color-blind users).
		const firstAriaLabel = badges[0]?.getAttribute('aria-label') ?? '';
		expect(firstAriaLabel).toMatch(/^Status:/);
	});

	// ── (c) AdminDashboard sidebar: aria-current="page" on active ──
	it('AdminDashboard sidebar: aria-current="page" on the active link', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/admin/overview']}>
				<AdminDashboard />
			</MemoryRouter>,
		);

		// 1. axe-core: no a11y violations on the rendered DOM.
		//    AdminDashboard is a layout shell with an <Outlet /> — the
		//    Outlet renders nothing here because MemoryRouter has no
		//    matching nested route, which is what we want for this
		//    focused test of the sidebar.
		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// 2. The active sidebar link carries aria-current="page".
		const activeLink = container.querySelector('[aria-current="page"]');
		expect(activeLink).not.toBeNull();
	});
});
