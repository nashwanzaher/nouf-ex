# `database/migrations/` — incremental schema changes

Sequential numbered SQL files. Each one applies **once** on top of the
current schema.

## Workflow

1. Add a new file: `database/migrations/NNNN_short_description.sql`
   where `NNNN` is the next number (`0002`, `0003`, …).
2. Use `ALTER TABLE … ADD COLUMN IF NOT EXISTS` style statements so the
   migration is safe to re-run.
3. Track it in `schema_migrations` (inserted by `scripts/db-setup.cjs`).
4. Never edit a deployed migration. Always add a new one.

## Files

| Version | Description | Applied at |
|---|---|---|
| `0001_baseline.sql` | Tracks the initial schema + seed | first run |

## Authoring tips

- Wrap the whole file in `BEGIN; … COMMIT;` so a partial failure rolls back.
- Use `IF NOT EXISTS` for additive changes; for destructive changes
  (`DROP COLUMN`), use a `DO $$ … $$` block that checks `information_schema`.
- For long-running DDL, prefer `ALTER TABLE … ADD COLUMN … DEFAULT …`
  (instant in PG 11+) over `UPDATE … SET col = …` followed by `NOT NULL`.
- Test against a fresh DB before committing.
