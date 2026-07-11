## Summary

<!-- What does this PR do? Link the roadmap item (G-N) or issue. -->

**Roadmap item:** G-_ (from [docs/README.md §5.2](../docs/README.md#52-roadmap)) or _N/A_
**Closes:** #_

## Type of change

- [ ] 🐛 Bug fix (`fix:`)
- [ ] ✨ New feature (`feat:`)
- [ ] 💥 Breaking change (`feat!:` or `BREAKING CHANGE:` footer)
- [ ] 📝 Documentation (`docs:`)
- [ ] 🎨 Code style / refactor (`style:` / `refactor:`)
- [ ] ⚡ Performance (`perf:`)
- [ ] 🧪 Tests (`test:`)
- [ ] 🔧 Build / tooling (`chore:` / `ci:`)

## Checklist

- [ ] `npm run lint` passes (0 errors, 0 warnings)
- [ ] `npm run typecheck` passes
- [ ] `npm run test:unit` passes — added tests for new code paths
- [ ] `npm run build` succeeds
- [ ] `CHANGELOG.md` updated under `[Unreleased]` if user-visible
- [ ] No secrets / no `.env` / no `console.log` introduced
- [ ] Documentation updated (see [CONTRIBUTING.md](CONTRIBUTING.md) → "Adding documentation")
- [ ] Commit messages follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/)

## Security considerations

- [ ] No new input from the client without Zod `.strict()` validation
- [ ] No ownership-by-WHERE bypass (every PATCH/DELETE checks `req.user.id` / role)
- [ ] No new SQL without parameterised queries
- [ ] If this touches auth/cookies/CSP: I read [.github/SECURITY.md](SECURITY.md) first

## Screenshots / recordings

_Attach if UI-visible._
