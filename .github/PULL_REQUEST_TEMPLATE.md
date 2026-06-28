<!--
  D.7 in MASTER_PLAN.md - Pull Request template.
  This file is shown automatically when a contributor opens a PR.
  The PR body is a checklist that helps reviewers triage quickly
  and catches the common "I forgot to update the docs" mistake.
-->

## What does this PR do?

<!-- One-sentence summary of the change. -->

## Type of change

<!-- Mark the relevant boxes with [x]. Only one "feat" / "fix" box. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change; coordinate with reviewers)
- [ ] Refactor (no behavior change; readability / structure)
- [ ] Documentation / docs only
- [ ] CI / build / tooling

## Related issues / docs

<!-- Link the PR to its source of truth. Example:
Closes #1234
Implements roadmap.md P1-7
Spec: docs/testing/PHASE_TEST_TASKS.md PHASE 4
-->

- Closes #
- Implements:
- Spec / design doc:

## How was this tested?

<!-- List the test commands you ran + their results. If CI ran them
already, say "see CI run #1234" - do NOT paste output. -->

- [ ] `npm run lint` (locally)
- [ ] `npm run typecheck` (locally)
- [ ] `npm test` (locally)
- [ ] `npx vitest run server/tests/path-to-new-test.ts` (locally)
- [ ] PHASE_NN spec passes locally
- [ ] CI run #____ on this branch (all green)
- [ ] Manual testing (describe below)

## Checklist (must all be true)

- [ ] My code follows the projects style guide (`docs/development/conventions.md`)
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas (zod schemas, race conditions, etc.)
- [ ] I have updated the relevant documentation (PHASE spec, README, architecture doc) - see `docs/MASTER_PLAN.md` §13 for the documentation update rules
- [ ] My changes generate no new TypeScript errors (`npx tsc -b --noEmit`)
- [ ] My changes generate no new ESLint warnings (`npx eslint .`)
- [ ] I have added tests that prove my fix is effective or my feature works (unit + integration as appropriate)
- [ ] New and existing unit tests pass locally (`npm test`)
- [ ] New and existing vitest integration tests pass (`npm test`)
- [ ] The PHASE design spec has been updated (if applicable)
- [ ] If my change touches the DB schema: a migration has been added to `database/migrations/`
- [ ] If my change touches the API: a smoke test in `phase10_merchant_flow.ps1` or a new PHASE spec has been added
- [ ] I have NOT committed any secrets, API keys, or .env values
- [ ] I have rebased my branch on the latest `main` (no merge commits)
- [ ] My branch name follows the convention: `feature/<scope>` / `fix/<scope>` / `chore/<scope>` / `audit/<date>`

## Breaking change checklist (only if "Breaking change" above)

- [ ] I have documented the breaking change in `CHANGELOG.md` under "Unreleased" with a `**BREAKING**:` prefix
- [ ] I have updated the affected PHASE spec(s) to reflect the new behavior
- [ ] I have considered the migration path for existing data (DB migrations, API versioning, etc.)
- [ ] I have flagged this in the team Slack channel for awareness

## Screenshots / recordings (UI changes only)

<!-- Drag-and-drop or paste before/after screenshots. -->

## Reviewer focus

<!-- Tell the reviewer what to look at. Example:
- The race condition fix at line 145 in cart.cts
- Whether the e2e tests in phase04_cart.ps1 are sufficient -->
