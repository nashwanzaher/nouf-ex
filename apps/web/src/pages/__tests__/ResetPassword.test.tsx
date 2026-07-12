import React from 'react';
/**
 * ResetPassword page tests
 *
 * ResetPassword is the consume side of the account-
 * recovery flow. It is reached from the email link the
 * user receives after ForgotPassword. The page accepts
 * a new password + confirmation, and on success surfaces
 * a 'Password changed!' state with a Sign-in CTA.
 *
 * Behaviour pinned (4 cases):
 *   (a) Renders both inputs + the submit button.
 *   (b) Empty submit -> 'This field is required'.
 *   (c) Short password (<6) -> 'Password must be at least
 *       6 characters'.
 *   (d) Mismatched confirm -> 'Passwords do not match'.
 *
 * The success path is harder to pin in a vitest run
 * because the page sleeps for 1500 ms before setSuccess.
 * The validation contract is the security-critical
 * surface here - it is the same Zod-friendly pattern
 * used in Login/Register, so the same parser-shape
 * mistakes would surface here. Deferred: a 5th case
 * for the success state can use waitFor with a
 * generous timeout if needed.
 */

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { installFetchSpy, uninstallFetchSpy } from '../../../mocks/fetch-spy';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

import ResetPassword from '../auth/ResetPassword';

function renderReset() {
	return render(
		<MemoryRouter initialEntries={['/reset']}>
			<Routes>
				<Route path="/reset" element={<ResetPassword />} />
			</Routes>
		</MemoryRouter>,
	);
}

function getNewPasswordInput(): Promise<HTMLInputElement> {
	return screen.findByPlaceholderText(/new password/i) as Promise<HTMLInputElement>;
}
function getConfirmInput(): Promise<HTMLInputElement> {
	return screen.findByPlaceholderText(/re-enter password/i) as Promise<HTMLInputElement>;
}

describe('ResetPassword page', () => {
	afterEach(() => cleanup());

	it('renders both password inputs and the submit button', async () => {
		renderReset();
		expect(await getNewPasswordInput()).toBeInTheDocument();
		expect(await getConfirmInput()).toBeInTheDocument();
		const form = document.querySelector('form')!;
		const submit = form.querySelector('button[type="submit"]')!;
		expect(submit).toBeInTheDocument();
	});

	it('shows "This field is required" on empty submit', async () => {
		renderReset();
		fireEvent.submit(document.querySelector('form')!);
		await waitFor(() => {
			expect(screen.getByText(/this field is required/i)).toBeInTheDocument();
		});
	});

	it('shows "Password must be at least 6 characters" on a short password', async () => {
		renderReset();
		fireEvent.change(await getNewPasswordInput(), { target: { value: '123' } });
		fireEvent.change(await getConfirmInput(), { target: { value: '123' } });
		fireEvent.submit(document.querySelector('form')!);
		await waitFor(() => {
			expect(
				screen.getByText(/password must be at least 6 characters/i),
			).toBeInTheDocument();
		});
	});

	it('shows "Passwords do not match" when confirm differs from new password', async () => {
		renderReset();
		fireEvent.change(await getNewPasswordInput(), { target: { value: 'validpassword1' } });
		fireEvent.change(await getConfirmInput(), { target: { value: 'differentpassword1' } });
		fireEvent.submit(document.querySelector('form')!);
		await waitFor(() => {
			expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
		});
	});
});
