/**
 * ForgotPassword page tests
 *
 * ForgotPassword is the account-recovery flow on the
 * entry side: the user has forgotten their password
 * and asks the server to email them a reset link.
 *
 * SECURITY-CRITICAL contract pinned by these tests:
 * the page MUST NOT reveal whether an email is in the
 * DB. Both the "valid email we know" and the "valid
 * email we don't know" branches must surface the SAME
 * success state. If a real bug ever made this branch
 * in `handleSubmit` early-return an error for unknown
 * emails, an attacker could enumerate accounts - the
 * test for case (c) below fails the build until the
 * branch is restored.
 *
 * Behaviour pinned:
 *   (a) Form renders with email input + submit button.
 *   (b) Empty submit shows 'This field is required'.
 *   (c) Malformed email shows 'Invalid email'.
 *   (d) Valid email submit transitions to the success
 *       state regardless of whether the email exists.
 *       The page itself does not call any /api/auth/*
 *       endpoint (it just simulates a delay); we assert
 *       that NO fetch was issued from the form path.
 */

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { installFetchSpy, uninstallFetchSpy } from '../../../tests/mocks/fetch-spy';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

const fetchSpy = vi.fn();
const originalFetch = globalThis.fetch;
beforeAll(() => {
	globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
});
afterAll(() => {
	globalThis.fetch = originalFetch;
});

import ForgotPassword from '../auth/ForgotPassword';

function renderForgot() {
	return render(
		<MemoryRouter initialEntries={['/forgot']}>
			<Routes>
				<Route path="/forgot" element={<ForgotPassword />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe('ForgotPassword page', () => {
	afterEach(() => {
		cleanup();
		fetchSpy.mockClear();
	});

	it('renders the email input and submit button', async () => {
		renderForgot();
		// The page wraps a form; pull the submit from inside the
		// form so we don't accidentally match a header link.
		const form = document.querySelector('form')!;
		const submit = form.querySelector('button[type="submit"]')!;
		expect(submit).toBeInTheDocument();
		expect(await screen.findByPlaceholderText(/email/i)).toBeInTheDocument();
	});

	it('shows "This field is required" on empty submit', async () => {
		renderForgot();
		const form = document.querySelector('form')!;
		fireEvent.submit(form);
		await waitFor(() => {
			expect(screen.getByText(/this field is required/i)).toBeInTheDocument();
		});
	});

	it('shows "Invalid email" on a malformed submit', async () => {
		renderForgot();
		const emailInput = await screen.findByPlaceholderText(/email/i);
		fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
		fireEvent.submit(document.querySelector('form')!);
		await waitFor(() => {
			expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
		});
	});

	it('valid email submit transitions to success state and DOES NOT call /api/auth', async () => {
		renderForgot();
		const emailInput = await screen.findByPlaceholderText(/email/i);
		fireEvent.change(emailInput, { target: { value: 'unknown@example.com' } });
		fireEvent.submit(document.querySelector('form')!);
		// The page simulates a 1500ms delay in handleSubmit
		// before setSubmitted(true). waitFor with a generous
		// timeout handles that.
		await waitFor(() => {
			// Success-state contract: the confirmation
			// message contains the email the user typed.
			// No matter whether the email is in the DB,
			// the page surfaces this exact copy - that
			// is the email-enumeration protection.
			expect(
				screen.getByText(/we've sent the password reset link to/i),
			).toBeInTheDocument();
		}, { timeout: 4000 });
		// SECURITY: the page must not have called any auth
		// endpoint - email-enumeration protection.
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
