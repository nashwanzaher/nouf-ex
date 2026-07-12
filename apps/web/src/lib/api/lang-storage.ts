/**
 * Storage accessor for the user's language preference.
 *
 * Extracted into its own module so unit tests can stub the
 * localStorage read without depending on DOM internals.
 *
 * **Why this matters:** happy-dom's localStorage implementation does NOT
 * proxy through `Storage.prototype`, so `vi.spyOn(Storage.prototype,
 * 'getItem')` has no observable effect — the spy installs but the real
 * `getItem` runs anyway. Splitting the read into a named export gives
 * tests a stable seam to mock.
 */
export function readStoredLang(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage.getItem('i18nextLng');
	} catch {
		return null;
	}
}
