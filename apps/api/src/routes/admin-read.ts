/**
 * Backward-compatibility re-export.
 *
 * The admin read-only endpoints have been merged into admin.ts so that
 * a single router owns the `/api/admin` namespace. Importing from this
 * file still works for existing tests and consumers, but it returns the
 * same router as `admin.ts`.
 */
export { adminRouter as adminReadRouter } from './admin.ts';
