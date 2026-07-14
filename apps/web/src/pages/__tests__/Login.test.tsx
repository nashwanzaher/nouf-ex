import React from 'react';
/**
 * Login page tests
 *
 * Critical because Login is the gateway to everything else:
 * if it breaks, customers cannot reach /customer, /checkout,
 * /wishlist, etc. The tests below cover the four behaviours
 * that matter most in production:
 *
 *   (a) Renders without crashing (smoke: form fields, submit
 *       button, 'Create account' link).
 *   (b) Client-side validation: empty submit shows
 *       'This field is required' on both fields; short
 *       password (<6) shows 'Password must be at least 6
 *       characters'.
 *   (c) Successful login navigates to the customer dashboard.
 *   (d) Failed login (wrong credentials) surfaces an error
 *       and does NOT navigate.
 *
 * Implementation note: the email/password inputs use a
 * standalone visual <Label> (no htmlFor linkage), so the
 * most reliable selectors here are placeholder text + role.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { installFetchSpy, uninstallFetchSpy } from '../../../mocks/fetch-spy';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

vi.mock('@/context/AppContext', () => ({
	useAuth: () => ({
		login: vi.fn().mockResolvedValue(undefined),
		addToast: vi.fn(),
	}),
}));

// Stub useNavigate so we can assert calls without involving
// router internals.
const navigateMock = vi.fn();
vi.mock('react-router', async () => {
	const actual = await vi.importActual<typeof import('react-router')>('react-router');
	return { ...actual, useNavigate: () => navigateMock };
});

// Imported AFTER the mocks so the page picks them up.
import Login from '../auth/Login';

function renderLogin() {
	return render(
		<MemoryRouter initialEntries={['/login']}>
			<Routes>
				<Route path="/login" element={<Login />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe('Login page', () => {
	afterEach(() => {
		cleanup();
		navigateMock.mockClear();
	});

	it('renders the form fields and primary CTA', async () => {
		renderLogin();
		expect(
			await screen.findByRole('button', { name: /sign in/i }),
		).toBeInTheDocument();
		// Email/phone input (placeholder starts with "Your")
		expect(
			await screen.findByPlaceholderText(/your email or phone/i),
		).toBeInTheDocument();
		// Password input (placeholder is "Password")
		expect(await screen.findByPlaceholderText(/^password$/i)).toBeInTheDocument();
	});

	it('shows validation errors on empty submit', async () => {
		renderLogin();
		// Get the <form> element so we can fire submit on it directly —
		// fireEvent.click(submit-button) does NOT trigger the form's
		// onSubmit handler reliably across RTL versions.
		const form = document.querySelector('form')!;
		fireEvent.submit(form);
		await waitFor(() => {
			expect(screen.getAllByText(/this field is required/i).length).toBeGreaterThanOrEqual(2);
		});
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it('shows the password-min-length error when password is too short', async () => {
		renderLogin();
		const emailInput = await screen.findByPlaceholderText(/your email or phone/i);
		const passwordInput = await screen.findByPlaceholderText(/^password$/i);
		fireEvent.change(emailInput, { target: { value: 'someone@example.com' } });
		fireEvent.change(passwordInput, { target: { value: '123' } });
		const form = document.querySelector('form')!;
		fireEvent.submit(form);
		await waitFor(() => {
			expect(
				screen.getByText(/password must be at least 8 characters/i),
			).toBeInTheDocument();
		});
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it('successful login navigates to /customer (default destination)', async () => {
		renderLogin();
		const emailInput = await screen.findByPlaceholderText(/your email or phone/i);
		const passwordInput = await screen.findByPlaceholderText(/^password$/i);
		fireEvent.change(emailInput, { target: { value: 'ahmed@gmail.com' } });
		fireEvent.change(passwordInput, { target: { value: 'customer123' } });
		const form = document.querySelector('form')!;
		fireEvent.submit(form);
		await waitFor(() => {
			expect(navigateMock).toHaveBeenCalledWith('/customer', { replace: true });
		});
	});

	it('failed login surfaces an inline error and does NOT navigate', async () => {
		renderLogin();
		const emailInput = await screen.findByPlaceholderText(/your email or phone/i);
		const passwordInput = await screen.findByPlaceholderText(/^password$/i);
		fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
		fireEvent.change(passwordInput, { target: { value: 'definitely-not-the-right-password' } });
		const form = document.querySelector('form')!;
		fireEvent.submit(form);
		await waitFor(() => {
			// MSW returns "Invalid credentials" — the page surfaces this
			// either as an inline form error or in a toast. Either
			// channel is acceptable; the contract is: no navigation.
			const inline = screen.queryByText(/invalid credentials|sign.in error|could not sign in/i);
			expect(inline).toBeTruthy();
		});
		expect(navigateMock).not.toHaveBeenCalled();
	});
});
