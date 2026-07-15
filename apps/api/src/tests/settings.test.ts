/**
 * settings.ts unit tests
 *
 * Pin the contract of the cached app_settings reader that
 * replaced the hardcoded 'YER' / 10000 / 500 literals in
 * orders.ts (commit P1-2 in commit history).
 *
 * Cases:
 *  (a) Cold cache + DB row present  -> DB value, cached.
 *  (b) Warm cache + DB would change  -> cached value (no DB read).
 *  (c) Cold cache + DB error        -> fallback, no crash.
 *  (d) Cold cache + DB returns undefined (empty table)
 *                                    -> fallback.
 *
 * The DB mock in setup.ts returns `{ rows: [] }` for every
 * `db.prepare(...).get(...)` call. That means .get(...) in
 * this test returns undefined - exactly scenario (d) above -
 * unless we override the spy for tests (b) and (a). We do
 * via a vi.spyOn(db, 'prepare') so the typed wrapper's
 * methods can be intercepted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _dumpSettingsCache,
  _resetSettingsCacheForTests,
  getSetting,
} from '../lib/settings.js';
import { db } from '../lib/shared.ts';

describe('getSetting()', () => {
    beforeEach(() => {
        _resetSettingsCacheForTests();
        vi.restoreAllMocks();
    });
    afterEach(() => {
        _resetSettingsCacheForTests();
        vi.restoreAllMocks();
    });

    it('returns the DB value when present (cold cache)', async () => {
        const getSpy = vi.fn().mockResolvedValue({ value: 'SAR' });
        const prepareSpy = vi.spyOn(db, 'prepare').mockReturnValue({
            get: getSpy,
            run: vi.fn(),
            all: vi.fn(),
        } as never);

        const value = await getSetting('DEFAULT_CURRENCY');
        expect(value).toBe('SAR');
        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(_dumpSettingsCache().get('DEFAULT_CURRENCY')?.value).toBe('SAR');
        prepareSpy.mockRestore();
    });

    it('returns the cached value without a second DB read (warm cache)', async () => {
        const getSpy = vi.fn().mockResolvedValue({ value: 'EUR' });
        const prepareSpy = vi.spyOn(db, 'prepare').mockReturnValue({
            get: getSpy,
            run: vi.fn(),
            all: vi.fn(),
        } as never);

        // First call - DB read.
        expect(await getSetting('DEFAULT_CURRENCY')).toBe('EUR');

        // Internal spy counter resets - second call should NOT hit DB.
        getSpy.mockClear();

        expect(await getSetting('DEFAULT_CURRENCY')).toBe('EUR');
        expect(getSpy).not.toHaveBeenCalled();
        prepareSpy.mockRestore();
    });

    it('falls back to the canonical default when the DB returns undefined', async () => {
        const getSpy = vi.fn().mockResolvedValue(undefined);
        const prepareSpy = vi.spyOn(db, 'prepare').mockReturnValue({
            get: getSpy,
            run: vi.fn(),
            all: vi.fn(),
        } as never);

        expect(await getSetting('DEFAULT_CURRENCY')).toBe('YER');
        expect(await getSetting('FREE_SHIPPING_THRESHOLD')).toBe('10000');
        expect(await getSetting('FLAT_SHIPPING_COST')).toBe('500');
        prepareSpy.mockRestore();
    });

    it('falls back gracefully on DB error (no crash)', async () => {
        const getSpy = vi.fn().mockRejectedValue(new Error('connection refused'));
        const prepareSpy = vi.spyOn(db, 'prepare').mockReturnValue({
            get: getSpy,
            run: vi.fn(),
            all: vi.fn(),
        } as never);

        // Must not throw.
        expect(await getSetting('DEFAULT_CURRENCY')).toBe('YER');
        prepareSpy.mockRestore();
    });

    it('returns the FALLBACK when an unknown key is requested', async () => {
        // No DB row, no fallback entry -> empty string.
        const getSpy = vi.fn().mockResolvedValue(undefined);
        const prepareSpy = vi.spyOn(db, 'prepare').mockReturnValue({
            get: getSpy,
            run: vi.fn(),
            all: vi.fn(),
        } as never);

        expect(await getSetting('SOMETHING_NOT_SEEDED')).toBe('');
        prepareSpy.mockRestore();
    });
});
