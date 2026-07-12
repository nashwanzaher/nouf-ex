import React from 'react';
/**
 * Layout component tests
 *
 * Layout composes Navbar + main content + (optionally) Footer + BottomNav.
 * The footer is suppressed on dashboard routes (/seller, /customer,
 * /admin) so the dashboard layout fills the viewport.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Layout from '../Layout';

vi.mock('../Navbar', () => ({
	default: () => <header data-testid="navbar">Navbar</header>,
}));
vi.mock('../Footer', () => ({
	default: () => <footer data-testid="footer">Footer</footer>,
}));
vi.mock('../BottomNav', () => ({
	default: () => <nav data-testid="bottomnav">BottomNav</nav>,
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en' },
	}),
}));

function renderLayoutAt(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<Layout>
				<div data-testid="content">Body</div>
			</Layout>
		</MemoryRouter>,
	);
}

describe('Layout', () => {
	afterEach(() => cleanup());

	it('renders the navbar, content, footer and bottom nav on public routes', () => {
		renderLayoutAt('/');
		expect(screen.getByTestId('navbar')).toBeInTheDocument();
		expect(screen.getByTestId('content')).toBeInTheDocument();
		expect(screen.getByTestId('footer')).toBeInTheDocument();
		expect(screen.getByTestId('bottomnav')).toBeInTheDocument();
	});

	it('hides the footer on /seller dashboard routes', () => {
		renderLayoutAt('/seller');
		expect(screen.getByTestId('navbar')).toBeInTheDocument();
		expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
	});

	it('hides the footer on /customer dashboard routes', () => {
		renderLayoutAt('/customer/orders');
		expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
	});

	it('hides the footer on /admin dashboard routes', () => {
		renderLayoutAt('/admin');
		expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
	});

	it('renders a skip-to-content link for accessibility', () => {
		renderLayoutAt('/');
		const skip = screen.getByText(/skip to content/i);
		expect(skip).toBeInTheDocument();
		expect(skip.closest('a')).toHaveAttribute('href', '#main-content');
	});

	it('renders a main element with the matching id', () => {
		renderLayoutAt('/');
		const main = document.getElementById('main-content');
		expect(main).toBeInTheDocument();
		expect(main?.tagName.toLowerCase()).toBe('main');
	});
});
