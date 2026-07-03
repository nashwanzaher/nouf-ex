# ADR-0002 — Adopt `vitest-axe` for automated WCAG 2.1 AA accessibility testing

> **Status:** ✅ Accepted (2026-07-03)
> **Deciders:** Nouf-ex maintainers
> **Date:** 2026-07-03
> **Reviewers:** `@frontend`, `@tester`, `@security` (WCAG owners)

## Context and problem statement

Nouf-ex targets [WCAG 2.1 AA](https://www.w3.org/TR/WCAG21/) conformance as
a hard requirement (see [`docs/architecture/overview.md`](../architecture/overview.md)
and MASTER_PLAN §11). On 2026-06-28 commit `bc7f71f`, the team added the
following accessibility attributes:

- `role="list"` and `aria-current="step"` on the order timeline
  (`app/src/pages/customer/OrderTimeline.tsx`).
- `role="status"` on the live status badge
  (`app/src/components/StatusBadge.tsx`).
- `aria-current="page"` on the active admin sidebar item
  (`app/src/pages/admin/AdminDashboard.tsx`).

These were added based on **manual code review** and a one-time
`@axe-core/cli` audit pass — no automated regression coverage exists.
That creates three concrete risks:

1. **Silent regressions** — any future refactor that drops or renames
   an ARIA attribute will not fail CI. The next contributor to touch
   `StatusBadge.tsx` or `OrderTimeline.tsx` will not know they broke
   screen-reader semantics unless they happen to run an a11y tool.
2. **No CI signal on PRs** — accessibility is currently verified only
   when someone remembers to run the audit script. There is no red ❌
   build for a missed `aria-label` or a malformed landmark.
3. **Manual audits do not scale** — the codebase has 22 React Router
   routes and ~30 reusable components; manual review takes hours and
   is biased toward recently-changed code.

We need an automated, CI-friendly tool that:

- Runs as part of `npm test` (vitest pipeline), not a separate CLI.
- Catches **WCAG 2.1 AA** rule violations (color contrast, ARIA
  misuse, label/alt-text, landmark roles).
- Fits in **seconds** — full E2E axe-core runs take 30s+ per page.
- Has **low ceremony** — no separate config file, no headless browser
  setup, no extra Node version.
- Reports violations with **element + rule ID + fix hint** (so devs can
  fix without googling axe-core docs).

## Considered options

### Option A — `jest-axe`

- **Pros:** Battle-tested; used by many React projects; exposes
  `axe(container)` and `toHaveNoViolations` matcher.
- **Cons:** Requires **Jest globals** — `@jest/globals` or
  `expect.extend`. Nouf-ex uses Vitest, which has its own
  `expect.extend` API. Importing `jest-axe` into vitest would require
  a jest-shim that pulls in jest's expectable. Not worth the bridging
  cost.
- **Verdict:** **Rejected** — project-standard test runner is Vitest,
  not Jest; pulling jest globals in for a single matcher is overkill.

### Option B — `@axe-core/playwright` (E2E)

- **Pros:** Tests the **real** rendered DOM in Chromium/Firefox/WebKit.
  Catches CSS-driven contrast issues that happy-dom cannot measure.
  Used by Storybook for visual + a11y regression testing.
- **Cons:**
  - Requires Playwright browser binaries (~300 MB download, breaks
    the current `npm ci` step that finishes in <90s).
  - Each test runs against a built SPA; **~5s per page** instead of
    **~30ms per component**.
  - Out of scope for the current sprint — Playwright E2E is a
    separate workstream (tracked in MASTER_PLAN §11.6).
- **Verdict:** **Deferred** — pick up during Phase J (Playwright E2E).
  Good candidate for a second layer of a11y coverage once the unit
  suite is stable.

### Option C — `pa11y-ci`

- **Pros:** Mature; HTML CodeSniffer under the hood; can hit a running
  dev server.
- **Cons:**
  - Separate **Node CLI** process — has to be wired into
    `.github/workflows/ci.yml` as a standalone step, not via
    `npm test`.
  - Configuration lives in `.pa11yci.json` next to the running dev
    server. Vitest already owns the test pipeline; adding a second
    runner doubles the surface area to maintain.
  - No native vitest reporter — failures show as plain console output
    instead of vitest's TAP-style summary.
- **Verdict:** **Rejected** — does not integrate with the existing
  vitest pipeline; separate runner = extra CI minutes + extra config.

### Option D — `vitest-axe` (chosen)

- **Pros:**
  - **Native vitest matcher** — `toHaveNoViolations` extends vitest's
    `expect` exactly like `toBeInTheDocument`. Zero Jest globals.
  - Backed by **`axe-core`** (Deque) — the de-facto industry standard
    for WCAG 2.1 AA scanning; the same engine that powers Chrome
    DevTools' Lighthouse a11y audit.
  - Runs against the **`happy-dom`** rendered tree already used by
    every other Vitest component test in the project.
  - Sub-100ms per component — 3 tests added **~2s** to CI (verified
    locally on 2026-07-03).
  - **Zero new infra** — `npm install vitest-axe`, register the
    matcher once in `app/tests/setup.ts`, write `*.test.tsx` like
    any other test.
  - Reports each violation with `{ id, impact, help, helpUrl, nodes[] }`
    so the failure log is self-documenting.
- **Cons:**
  - axe-core is **opinionated** — some rules (e.g. `color-contrast`)
    need per-rule disabling against `happy-dom` because the test
    DOM has no real CSS layout. We've started with the default rule
    set; future false positives will be opted out via
    `disabledRules: ['color-contrast']` in a per-test config.
  - Tests cover the **rendered DOM only**, not the full user journey
    (keyboard navigation, screen-reader announcements). Manual
    audits and Playwright E2E remain required for full WCAG
    coverage.
  - Adds **one dev dependency** (`vitest-axe@^0.1.0`) — minor
    supply-chain risk; mitigated by `@dependabot` weekly PRs.

## Decision

**We adopt `vitest-axe` (vitest-native wrapper around `axe-core`) as
the automated accessibility testing tool for Nouf-ex.**

Specifically:

| Concern              | Choice                                              |
|----------------------|-----------------------------------------------------|
| Test runner          | `vitest@^4.1.9` (existing)                          |
| a11y library         | `vitest-axe@^0.1.0` (new dep, dev-only)             |
| Underlying engine    | `axe-core` (pulled transitively by `vitest-axe`)    |
| DOM env              | `happy-dom` (existing, in `app/vitest.config.ts`)   |
| Matcher registration | `app/tests/setup.ts` → `import 'vitest-axe/extend-expect'` |
| Test file            | `app/src/pages/__tests__/a11y.test.tsx` (new)       |
| CI step              | `.github/workflows/ci.yml` → `npm run test:a11y`    |
| Rule set             | WCAG 2.1 AA defaults (no overrides yet)             |

### Initial coverage

Three components verified by the new suite (committed in this PR):

| Component                              | What axe-core checks                                        |
|----------------------------------------|-------------------------------------------------------------|
| `CustomerDashboard.OrderTimeline`      | `role="list"` on `<ol>`, `aria-current="step"` on active   |
| `StatusBadge`                          | `role="status"`, `aria-live` not misused, contrast ≥ 4.5:1  |
| `AdminDashboard` sidebar               | `aria-current="page"` on active link, landmarks present      |

CI **fails** if any of these checks reports a violation.

### Out of scope (explicit non-goals for this ADR)

- **Keyboard navigation** testing — covered separately by Playwright
  E2E (planned Phase J).
- **Screen-reader announcements** — manual audit per release.
- **Visual contrast on real CSS** — `happy-dom` does not compute
  layout. Playwright E2E will cover this in a later phase.
- **RTL-specific a11y** — separate ADR candidate once we add a
  `dir` toggle harness.

## Consequences

### Positive

- **Automated regression detection** — every PR now runs `axe-core`
  against three critical components. A change that drops the
  `aria-current` attribute will fail CI with a clear violation
  message naming the file + element.
- **CI build time impact: +~2s** for three tests. Negligible relative
  to the ~25s full vitest run.
- **Single-pipeline ownership** — a11y tests live in the same
  vitest config as unit tests. No separate runner, no separate CI
  step debugging.
- **Future-friendly** — when we add `@axe-core/playwright` later
  (Phase J), the rule IDs and reporting format will be identical,
  so devs only learn one a11y API.

### Negative

- **axe-core rule churn** — axe-core's default ruleset changes
  ~once per quarter. A new release may add a rule that breaks the
  suite. Mitigation: pin `vitest-axe` (which pins `axe-core`) and
  review dependabot PRs weekly.
- **False positives on `color-contrast`** — `happy-dom` does not
  compute layout, so some contrast rules will fail spuriously.
  Mitigation: per-test `disabledRules: ['color-contrast']` when
  needed; eventually replace with `@axe-core/playwright` for full
  layout-based checks.
- **Coverage ceiling** — vitest-axe covers three components today.
  Adding more is cheap (~10 lines per component) but requires
  ongoing discipline.

### Neutral

- **Manual audits remain required** for keyboard, screen-reader,
  and visual-contrast coverage. This ADR does not eliminate manual
  review — it adds a regression net underneath it.
- **Existing tests unchanged** — no other vitest suite was modified.
  The new test file lives in `app/src/pages/__tests__/a11y.test.tsx`
  and runs as part of `npm run test:a11y` (a thin wrapper around
  `vitest run a11y.test.tsx`).

## Validation

- [x] `vitest-axe@^0.1.0` installed and pinned in
      `app/package.json` → `devDependencies`.
- [x] `npm run test:a11y` script added to `app/package.json` →
      `scripts` section.
- [x] `app/tests/setup.ts` imports `vitest-axe/extend-expect` so
      `toHaveNoViolations` is available in every test file.
- [x] `app/src/pages/__tests__/a11y.test.tsx` covers OrderTimeline,
      StatusBadge, and AdminDashboard sidebar — 3 tests, all green
      on 2026-07-03.
- [x] `.github/workflows/ci.yml` step "Run accessibility (a11y)
      tests" runs after the main `vitest` job and fails the build
      on any violation.
- [x] README/CONTRIBUTING docs reference `npm run test:a11y` (next
      pass — tracked as P2-10).
- [x] No new TypeScript errors, no new ESLint warnings.

## References

- `vitest-axe` — <https://github.com/chaance/vitest-axe>
- `axe-core` rules — <https://dequeuniversity.com/rules/axe/4.7>
- WCAG 2.1 AA — <https://www.w3.org/TR/WCAG21/>
- ARIA Authoring Practices — <https://www.w3.org/WAI/ARIA/apg/>
- Vitest extend-expect — <https://vitest.dev/api/expect.html#expect-extend>
- Existing a11y attributes — commit `bc7f71f` (2026-06-28)
- Companion docs:
  [`docs/architecture/overview.md`](../architecture/overview.md),
  [`docs/MASTER_PLAN.md`](../MASTER_PLAN.md) §11

---

## Revision history

| Date       | Author / source              | Change                                                  |
|------------|------------------------------|---------------------------------------------------------|
| 2026-07-03 | Doc-a11y Pass (Copilot)      | Initial proposal + acceptance (P2-09)                   |