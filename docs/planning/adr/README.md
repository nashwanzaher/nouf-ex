# Architecture Decision Records (ADR)

> **Last updated:** 2026-07-02.
> **Format:** Michael Nygard's [template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
> (extended with **Validation** and **Revision history** sections, per the
> Microsoft Docs and ISO/IEC/IEEE 29119-3 advice on decision traceability).
> **Indexing:** each ADR lives at `docs/planning/adr/NNNN-<slug>.md` where
> `NNNN` is the next 4-digit zero-padded sequence number.

## Index

| ID                                       | Title                                                              | Status   | Date       |
|------------------------------------------|--------------------------------------------------------------------|----------|------------|
| [ADR-0001](0001-mkdocs-and-release-please.md) | Adopt MkDocs (Material) + release-please for docs automation | ✅ Accepted | 2026-07-02 |
| [ADR-0002](0002-vitest-axe-a11y.md)           | Adopt `vitest-axe` for automated WCAG 2.1 AA testing          | ✅ Accepted | 2026-07-03 |

## Conventions

- One ADR per significant decision. "Significant" = it would be costly to
  reverse, or it locks in a contract with another system or team.
- Use **imperative mood** in the title ("Adopt X", "Switch from Y to Z").
- Sections in the order: **Context → Considered options → Decision →
  Consequences → Validation → References → Revision history**.
- Statuses:
  - **Proposed** — drafted, under discussion.
  - **Accepted** — agreed, in effect.
  - **Superseded** — replaced by a later ADR (link to it).
  - **Deprecated** — no longer in effect, no replacement.

## How to add a new ADR

1. Copy `docs/planning/adr/README.md` to `docs/planning/adr/NNNN-<slug>.md`
   with the next sequence number.
2. Replace this README's "Index" row with the new ADR + bump status from
   _Proposed_ to _Accepted_ (or leave _Proposed_ if still under review).
3. Open a PR with both files — review will check the validation criteria.

## References

- Michael Nygard — _Documenting Architecture Decisions_:
  <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>
- Microsoft Docs — _Architecture decision records_:
  <https://learn.microsoft.com/en-us/azure/architecture/architectures/architecture-decision-records>
- ISO/IEC/IEEE 29119-3 — _Software testing — Part 3: Test documentation_
  (ADR traces into §5.3 "Test design specification")
- ADR GitHub tools:
  - [`adr-tools`](https://github.com/npryce/adr-tools) — command-line
    management (optional — we keep the index manual for now)
  - [`log4brains`](https://github.com/flexponsive/log4brains) — web UI
    (optional, can be added later)
