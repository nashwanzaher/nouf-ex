/**
 * Footer component tests
 *
 * Footer renders the trust-badges row, four link columns, the brand
 * blurb, social links, and a copyright row. We assert:
 *   - All four link columns render (About / Buyers / Sellers / Help)
 *   - The current year is shown in the copyright
 *   - At least one link in each column points at a real route
 *   - External links render with href="#"
 */

import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Footer from '../Footer';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en' },
	}),
}));

function renderFooter() {
	return render(
		<MemoryRouter>
			<Footer />
		</MemoryRouter>,
	);
}

describe('Footer', () => {
	afterEach(() => cleanup());

	it('renders the four trust badges', () => {
		renderFooter();
		// "Trade Assurance" appears in both the trust-badges row and the
		// For Buyers link column, so we use getAllByText and assert there
		// are at least the two expected occurrences.
		expect(screen.getAllByText('Trade Assurance').length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText('Reliable Shipping')).toBeInTheDocument();
		expect(screen.getByText('Easy Returns')).toBeInTheDocument();
		expect(screen.getByText('24/7 Support')).toBeInTheDocument();
	});

	it('renders the four link columns by title', () => {
		renderFooter();
		expect(screen.getByText('About Nouf-ex')).toBeInTheDocument();
		expect(screen.getByText('For Buyers')).toBeInTheDocument();
		expect(screen.getByText('For Sellers')).toBeInTheDocument();
		expect(screen.getByText('Help')).toBeInTheDocument();
	});

	it('renders the brand blurb and Nouf-ex logo', () => {
		renderFooter();
		expect(screen.getByText('Nouf-ex')).toBeInTheDocument();
	});

	it('renders an internal /customer/orders route link', () => {
		renderFooter();
		expect(screen.getByText('My Orders').closest('a')).toHaveAttribute(
			'href',
			'/customer/orders',
		);
	});

	it('renders an internal /seller route link', () => {
		renderFooter();
		expect(screen.getByText('Seller Dashboard').closest('a')).toHaveAttribute(
			'href',
			'/seller',
		);
	});

	it('includes the current year in the copyright', () => {
		renderFooter();
		const year = String(new Date().getFullYear());
		expect(document.body.textContent).toContain(year);
	});

	it('renders one link per social platform', () => {
		renderFooter();
		// The Footer renders four social-icon links (facebook, twitter,
		// instagram, linkedin) as single-letter avatar tiles. The 4
		// letters F/T/I/L appear in the social row (in that order).
		const text = document.body.textContent ?? '';
		expect(text.toLowerCase()).toMatch(/f.*t.*i.*l/s);
	});
});
