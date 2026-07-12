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

// `declare module 'vitest'` augments an external module's exported
// types. ESLint's `no-unused-vars` does not understand module
// augmentation semantics and reports each `interface Foo` and its
// generic parameter as unused (the augmentation is consumed by
// TypeScript at compile time, not by any code in this file). The
// rule is disabled locally for this block only.
//
// We restore the original `interface Foo extends AxeMatchers {}`
// (empty body) shape because that is the canonical TypeScript
// interface-merging form. My earlier attempt to add a phantom
// `_axeBrand?: T` member preserved the ESLint silence but BROKE the
// TypeScript merge: the augmented `Assertion<AxeResults>` no longer
// resolved `toHaveNoViolations` (TS sees the phantom member and
// decides the augmentation is no longer compatible). The proper
// fix is to keep the empty body AND tell ESLint to accept it.
declare module 'vitest' {
	interface AxeMatchers {
		toHaveNoViolations(): void;
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
	interface Assertion<T = unknown> extends AxeMatchers {}
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	interface AsymmetricMatchersContaining extends AxeMatchers {}
}

declare module 'vitest-axe/matchers' {
	// Re-export toHaveNoViolations as a value (function) so callers can
	// `import { toHaveNoViolations } from 'vitest-axe/matchers'` and
	// pass it to `expect.extend()` at runtime.
	export function toHaveNoViolations(this: unknown, ...args: unknown[]): unknown;
}

// Also re-export the AxeCore.AxeResults shape so consumers can annotate.
export type AxeResults = AxeCore.AxeResults;
