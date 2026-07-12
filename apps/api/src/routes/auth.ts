/**
 * Auth routes compatibility shim.
 *
 * All handlers now live in `modules/auth/`. This file re-exports the
 * router so existing imports in `src/index.ts` keep working.
 */
export { authRouter } from '../modules/auth/routes.ts';
