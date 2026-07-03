/**
 * Type augmentation so that the `toHaveNoViolations()` matcher from
 * `vitest-axe` is visible on the `expect()` Assertion type when type
 * checking test files (especially under `tsc -b --noEmit` which is
 * stricter than the vitest runtime type-checker).
 *
 * Why this file exists:
 *   `vitest-axe` ships its own `extend-expect.d.ts` that does
 *   `declare global { namespace Vi { interface Assertion extends
 *   AxeMatchers {} } }`. This is the documented `Vi` namespace but
 *   Vitest's own `expect()` returns `Assertion` from the `vitest`
 *   module — not the `Vi` namespace. Under `tsc -b`, the augmentation
 *   does not propagate to the `Assertion` type that the compiler
 *   sees, so callers get "Property 'toHaveNoViolations' does not exist
 *   on type 'Assertion<AxeResults>'."
 *
 *   We re-declare here in the conventional `declare module 'vitest'`
 *   form which TypeScript does pick up across all test files. The
 *   augmentation is local to this project (the `vitest-axe` package's
 *   own d.ts uses the non-standard Vi namespace).
 *
 *   At runtime, `vitest-axe/extend-expect` still registers the matcher
 *   via `expect.extend()` — this .d.ts file is type-only and has no
 *   runtime effect.
 */
import type AxeCore from 'axe-core';

declare module 'vitest' {
	interface AxeMatchers<R = unknown> {
		toHaveNoViolations(): R;
	}

	interface Assertion<T = any> extends AxeMatchers {}
	interface AsymmetricMatchersContaining extends AxeMatchers {}
}

// Also re-export the AxeCore.AxeResults shape so consumers can annotate.
export type AxeResults = AxeCore.AxeResults;
