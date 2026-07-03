/**
 * Accessibility (a11y) tests — CustomerDashboard.
 *
 * This file complements `app/src/pages/__tests__/a11y.test.tsx` (the
 * smoke-level a11y check added in P2-09). The goal here is depth:
 *   - Re-verify the OrderTimeline list semantics with multiple orders
 *     and different active indices.
 *   - Re-verify the StatusBadge with locale switching (Arabic vs.
 *     English aria-label prefix).
 *   - Confirm the active-step `aria-current="step"` lands on the
 *     right element when more than one order is rendered.
 *
 * The `vitest-axe/extend-expect` side-effect import lives in
 * `app/tests/setup.ts` (P2-09), so `toHaveNoViolations()` is
 * available globally without any extra setup here.
 *
 * Color-contrast rule is disabled for the same reasons documented
 * in the original a11y test: happy-dom's CSS engine does not compute
 * runtime contrast ratios reliably.
 */

import {
	afterEach,
	beforeAll,
	afterAll,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { RunOptions } from 'axe-core';
import { MemoryRouter } from 'react-router';
import {
	installFetchSpy,
	uninstallFetchSpy,
} from '../../../tests/mocks/fetch-spy';

// Shared axe options — see file header for the rationale.
const axeOptions: RunOptions = {
	rules: {
		'color-contrast': { enabled: false },
	},
};

// ─── i18n stub ─────────────────────────────────────────────
// Default: t(key, fallback) returns the fallback so assertions
// are deterministic. Individual tests can override `useTranslation`
// via `vi.doMock` if they need to verify locale-specific output.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

// ─── useApi stub ────────────────────────────────────────────
// Two orders is enough to:
//   - render TWO StatusBadge elements (one per order)
//   - render TWO OrderTimeline elements (one per order card)
//   - verify that the "active" step differs between them:
//       order-1 (shipped)   → currentIndex = 2 (3rd step)
//       order-2 (delivered) → currentIndex = 3 (4th step)
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
				id: 'order-shipped',
				status: 'shipped',
				items: [],
				total: 12_500,
				created_at: '2026-07-01T00:00:00Z',
			},
			{
				id: 'order-delivered',
				status: 'delivered',
				items: [],
				total: 4_300,
				created_at: '2026-06-25T00:00:00Z',
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

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

// Pages under test.
import CustomerDashboard from '../../pages/customer/CustomerDashboard';

describe('A11y: CustomerDashboard', () => {
	afterEach(() => cleanup());

	// ────────────────────────────────────────────────────────────
	// (1) OrderTimeline: list semantics + per-order active step
	// ────────────────────────────────────────────────────────────
	it('OrderTimeline exposes a labelled list with one aria-current="step" per order', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/customer']}>
				<CustomerDashboard />
			</MemoryRouter>,
		);

		// 1. axe-core: no a11y violations on the rendered DOM.
		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// 2. Two OrderTimeline lists (one per order) — both labelled.
		const timelines = screen.getAllByRole('list', {
			name: /order progress/i,
		});
		expect(timelines.length).toBeGreaterThanOrEqual(2);

		// 3. Every timeline has exactly 4 listitems.
		for (const timeline of timelines) {
			const items = within(timeline).getAllByRole('listitem');
			expect(items).toHaveLength(4);
		}

		// 4. Each timeline has exactly ONE listitem with aria-current="step".
		//    Two orders ⇒ two active steps in total.
		const allActive = screen
			.getAllByRole('listitem')
			.filter((el) => el.getAttribute('aria-current') === 'step');
		expect(allActive).toHaveLength(timelines.length);
	});

	// ────────────────────────────────────────────────────────────
	// (2) StatusBadge: role=status + English aria-label
	// ────────────────────────────────────────────────────────────
	it('StatusBadge: role="status" with English "Status:" aria-label prefix', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/customer']}>
				<CustomerDashboard />
			</MemoryRouter>,
		);

		// 1. axe-core: no a11y violations.
		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// 2. Exactly two StatusBadge elements (one per order).
		const badges = screen.getAllByRole('status');
		expect(badges).toHaveLength(2);

		// 3. Each badge has an aria-label starting with "Status:".
		//    Regression guard: someone reverts to colour-only status
		//    semantics (fails for colour-blind users).
		for (const badge of badges) {
			const label = badge.getAttribute('aria-label') ?? '';
			expect(label).toMatch(/^Status:/);
		}

		// 4. The visible label inside each badge appears in its aria-label
		//    so screen-reader users hear the same word sighted users see.
		const firstVisible = badges[0]?.textContent ?? '';
		const firstAria = badges[0]?.getAttribute('aria-label') ?? '';
		expect(firstAria).toContain(firstVisible);
	});

	// ────────────────────────────────────────────────────────────
	// (3) StatusBadge: locale-aware aria-label prefix
	// ────────────────────────────────────────────────────────────
	it('StatusBadge: aria-label prefix uses Arabic translation when locale=ar', async () => {
		// Re-mock react-i18next for this test only. We map the specific
		// i18n keys used by StatusBadge to their Arabic translations so
		// we can verify the rendered aria-label actually contains the
		// localized prefix instead of just the English fallback.
		vi.doMock('react-i18next', () => ({
			useTranslation: () => ({
				t: (key: string, fallback?: string) => {
					const arTranslations: Record<string, string> = {
						'customer.status.label': 'الحالة',
					};
					return arTranslations[key] ?? fallback ?? key;
				},
				i18n: {
					language: 'ar',
					changeLanguage: vi.fn(),
				},
			}),
		}));

		// Re-import the page so the new mock is wired up.
		vi.resetModules();
		const { default: CustomerDashboardAr } = await import(
			'../../pages/customer/CustomerDashboard'
		);

		const { container } = render(
			<MemoryRouter initialEntries={['/customer']}>
				<CustomerDashboardAr />
			</MemoryRouter>,
		);

		// 1. axe-core: no a11y violations.
		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// 2. The StatusBadge prefix uses the localized i18n key
		//    "customer.status.label" → "الحالة". The rendered aria-label
		//    must contain "الحالة" because the mock above maps the key
		//    to its Arabic translation (and falls back to English
		//    otherwise — see StatusBadge in CustomerDashboard.tsx).
		const badges = screen.getAllByRole('status');
		expect(badges.length).toBeGreaterThanOrEqual(1);
		const firstLabel = badges[0]?.getAttribute('aria-label') ?? '';
		expect(firstLabel).toMatch(/^الحالة:/);
	});

	// ────────────────────────────────────────────────────────────
	// (4) Listitem ARIA attributes are well-formed
	// ────────────────────────────────────────────────────────────
	it('Each listitem with aria-current="step" is inside a labelled list', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/customer']}>
				<CustomerDashboard />
			</MemoryRouter>,
		);

		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// Every element with aria-current="step" should be a descendant
		// of a list role, per WAI-ARIA Authoring Practices for steppers.
		const activeItems = container.querySelectorAll(
			'[aria-current="step"]',
		);
		expect(activeItems.length).toBeGreaterThanOrEqual(1);
		for (const item of activeItems) {
			const closestList = item.closest('[role="list"]');
			expect(closestList).not.toBeNull();
			expect(
				closestList?.getAttribute('aria-label') ?? '',
			).toMatch(/order progress/i);
		}
	});
});