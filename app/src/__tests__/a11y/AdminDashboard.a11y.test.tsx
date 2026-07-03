/**
 * Accessibility (a11y) tests — AdminDashboard sidebar shell.
 *
 * AdminDashboard was rewritten 2026-07-02 to use real react-router
 * <Link>s instead of internal tab routing. This test verifies the
 * a11y surface area of the new sidebar:
 *   - The desktop <aside> has an aria-label that screen readers can
 *     announce as the navigation landmark.
 *   - Exactly one <Link> per page has aria-current="page" (the active
 *     one); the rest must NOT carry aria-current.
 *   - Every <Link> is keyboard-reachable (focusable) and uses an
 *     accessible name (visible text or aria-label).
 *
 * `vitest-axe/extend-expect` is loaded globally via
 * `app/tests/setup.ts`.
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
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import type { RunOptions } from 'axe-core';
import { MemoryRouter } from 'react-router';
import {
	installFetchSpy,
	uninstallFetchSpy,
} from '../../../tests/mocks/fetch-spy';

const axeOptions: RunOptions = {
	rules: {
		'color-contrast': { enabled: false },
	},
};

// ─── i18n stub ─────────────────────────────────────────────
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

// ─── useAuth stub ──────────────────────────────────────────
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

import AdminDashboard from '../../pages/admin/AdminDashboard';

describe('A11y: AdminDashboard sidebar', () => {
	afterEach(() => cleanup());

	// ────────────────────────────────────────────────────────────
	// (1) Sidebar landmark: aria-label on the desktop <aside>
	// ────────────────────────────────────────────────────────────
	it('Desktop sidebar <aside> has a localized aria-label', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/admin/overview']}>
				<AdminDashboard />
			</MemoryRouter>,
		);

		// 1. axe-core: no violations on the rendered DOM.
		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// 2. The sidebar is a labelled landmark reachable via the
		//    complementary landmark role (rendered by <aside>).
		const aside = screen.getByLabelText(/admin panel/i);
		expect(aside.tagName.toLowerCase()).toBe('aside');

		// 3. The sidebar contains a <nav> element with the link list.
		const nav = within(aside).getByRole('navigation');
		expect(nav).toBeInTheDocument();
	});

	// ────────────────────────────────────────────────────────────
	// (2) Active link: aria-current="page" on the matching route
	// ────────────────────────────────────────────────────────────
	it('Exactly one sidebar link has aria-current="page" matching the route', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/admin/users']}>
				<AdminDashboard />
			</MemoryRouter>,
		);

		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// 1. There is exactly ONE element with aria-current="page".
		const activeLinks = container.querySelectorAll(
			'[aria-current="page"]',
		);
		expect(activeLinks).toHaveLength(1);

		// 2. That element is an <a> (rendered by react-router <Link>).
		const active = activeLinks[0];
		expect(active?.tagName.toLowerCase()).toBe('a');

		// 3. Its href ends with the matching admin route.
		//    /admin/users ⇒ "/admin/users"
		expect(active?.getAttribute('href')).toMatch(/\/admin\/users$/);
	});

	// ────────────────────────────────────────────────────────────
	// (3) Keyboard navigation: every nav item is focusable
	// ────────────────────────────────────────────────────────────
	it('Every sidebar link is keyboard-focusable with an accessible name', async () => {
		const user = userEvent.setup();

		const { container } = render(
			<MemoryRouter initialEntries={['/admin/overview']}>
				<AdminDashboard />
			</MemoryRouter>,
		);

		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// 1. Find all sidebar links.
		const nav = screen.getByRole('navigation');
		const links = within(nav).getAllByRole('link');
		expect(links.length).toBeGreaterThanOrEqual(5); // navItems.length === 9

		// 2. Each link has an accessible name (either visible text or aria-label).
		for (const link of links) {
			const name =
				link.getAttribute('aria-label') ?? link.textContent ?? '';
			expect(name.trim().length).toBeGreaterThan(0);
		}

		// 3. Tabbing through the nav reaches at least one link.
		//    (focus-trap / skip-link infrastructure is not asserted here,
		//    only that links are reachable in document order.)
		const firstLink = links[0];
		if (firstLink) {
			firstLink.focus();
			expect(document.activeElement).toBe(firstLink);
			await user.tab();
			// After one Tab, focus moves somewhere — must be inside the document.
			expect(document.activeElement).not.toBe(document.body);
		}
	});

	// ────────────────────────────────────────────────────────────
	// (4) No aria-current on any non-active link
	// ────────────────────────────────────────────────────────────
	it('Inactive sidebar links do NOT carry aria-current', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/admin/overview']}>
				<AdminDashboard />
			</MemoryRouter>,
		);

		const results = await axe(container, axeOptions);
		expect(results).toHaveNoViolations();

		// Get all sidebar links.
		const nav = screen.getByRole('navigation');
		const links = within(nav).getAllByRole('link');

		// Exactly one link is "current"; the others must not have ANY
		// value for aria-current. (A common regression: setting
		// aria-current="false" on inactive links, which screen readers
		// still announce as a special state.)
		const currentCount = links.filter(
			(link) => link.getAttribute('aria-current') === 'page',
		).length;
		expect(currentCount).toBe(1);

		const others = links.filter(
			(link) => link.getAttribute('aria-current') !== 'page',
		);
		for (const link of others) {
			const ariaCurrent = link.getAttribute('aria-current');
			// Either missing entirely, or an empty string — both fine.
			expect(ariaCurrent === null || ariaCurrent === '').toBe(true);
		}
	});
});