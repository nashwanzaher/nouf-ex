# agent_db — central knowledge base

A small PostgreSQL 17 database that stores **information, experiences,
skills, and reference material** for the Nouf-ex project. It runs in
its own Docker container (`postgres_agent`) so it has an independent
lifecycle from the main `noufex_db`.

---

## Why a separate database?

| Concern | noufex_db | agent_db |
| --- | --- | --- |
| **Purpose** | E-commerce domain (users, products, orders, …) | Knowledge / meta (lessons, skills, references) |
| **Schema velocity** | Stable (versioned migrations) | Liberal (the user adds entries constantly) |
| **Backup cadence** | Critical — customer data | Useful but reproducible from the project repo |
| **Access tier** | `noufex_app` is the runtime user | `agent_app` is the runtime user (separate password) |
| **Lifecycle** | Lives on the host Postgres 17 | Lives in the `postgres_agent` container |

Keeping them separate means a destructive `DROP TABLE` on a knowledge
table cannot accidentally take the storefront down.

---

## Connection

Connection data is in the project-root `.env` (gitignored). Never commit
the real password. The relevant keys:

```env
AGENT_DB_HOST=localhost
AGENT_DB_PORT=5433
AGENT_DB_NAME=agent_db
AGENT_DB_USER=agent_app
AGENT_DB_PASSWORD=<redacted>
AGENT_DATABASE_URL=postgresql://agent_app:***@localhost:5433/agent_db
```

The application uses the **`agent_app`** least-privilege role. The
**`postgres`** superuser is only used once, by `db-setup.cjs`, to
create roles + schema + seed.

---

## Files

| File | Purpose |
| --- | --- |
| `schema.sql` | 6 base tables: `knowledge_entries`, `knowledge_entry_revisions`, `tags`, `knowledge_entry_tags`, `skill_dependencies`, `entry_links` |
| `functions.sql` | 4 PL/pgSQL functions: `trg_set_updated_at`, `fn_upsert_tag`, `fn_snapshot_entry`, `fn_bump_tag_usage` |
| `triggers.sql` | Wires the functions to the tables |
| `views.sql` | 4 read-only views with `security_invoker` |
| `roles.sql` | 3 roles (`agent_owner`, `agent_app`, `agent_readonly`) + GRANTs |
| `seed.sql` | 10 tags + 4 entries (one per kind) |
| `migrations/0001_baseline.sql` | Tracks the baseline in `schema_migrations` |
| `db-setup.cjs` | One-time setup CLI (idempotent, safe to re-run) |

The file layout mirrors `database/` (the noufex_db pipeline) so the
two databases feel like siblings.

---

## Schema overview

```
                         ┌─────────────────────┐
                         │   knowledge_entries │  ← unified table, kind discriminator
                         │   (6 columns)       │
                         └──────────┬──────────┘
                                    │ 1:N
                ┌───────────────────┼───────────────────┐
                ▼                   ▼                   ▼
    ┌────────────────────┐  ┌────────────────┐  ┌─────────────┐
    │ knowledge_entry_   │  │ knowledge_     │  │ entry_links │
    │ revisions          │  │ entry_tags     │  │ (self-M2M)  │
    │ (immutable history)│  │ (M2M)          │  │             │
    └────────────────────┘  └────────┬───────┘  └─────────────┘
                                     │ N:1
                                     ▼
                                ┌─────────┐
                                │  tags   │  ← taxonomy
                                └─────────┘
```

**Entry kinds** (via `kind` CHECK):
- `information` — short notes, lessons learned
- `experience` — past events with `payload.outcome` ∈ {success, failure, neutral}
- `skill` — capabilities with `payload.proficiency_level` (1–5)
- `reference` — citations with `payload.url` and `payload.citation_count`

---

## Bilingual FTS

`search_tsv` is a STORED generated column that concatenates two
weighted tsvectors:

```sql
search_tsv = setweight(to_tsvector('arabic', title_ar || body_ar), 'A')
          || setweight(to_tsvector('english', title_en || body_en), 'B')
```

A single GIN index covers both languages. Queries use:

```sql
SELECT id, title_ar, title_en,
       ts_rank(search_tsv, websearch_to_tsquery('arabic', $1)) AS ar_rank,
       ts_rank(search_tsv, websearch_to_tsquery('english', $1)) AS en_rank
FROM   knowledge_entries
WHERE  search_tsv @@ websearch_to_tsquery('arabic', $1)
   OR  search_tsv @@ websearch_to_tsquery('english', $1)
ORDER  BY GREATEST(ar_rank, en_rank) DESC
LIMIT  20;
```

The `setweight(A)` on Arabic means Arabic title matches always outrank
English body matches for the same entry — useful when the corpus is
predominantly Arabic.

---

## Quick start

```sh
# 1. Start the container (one-time)
docker run -d --name postgres_agent \
  -e POSTGRES_DB=agent_db \
  -e POSTGRES_USER=agent_app \
  -e POSTGRES_PASSWORD=<generated> \
  -v postgres_agent_data:/var/lib/postgresql/data \
  -p 5433:5432 \
  --restart unless-stopped \
  postgres:17-alpine

# 2. Apply the schema + seed (from project root)
cd app && node ../agent_db/db-setup.cjs

# 3. Verify
docker exec postgres_agent psql -U agent_app -d agent_db -c \
  "SELECT kind, COUNT(*) FROM knowledge_entries GROUP BY kind;"
```

To wipe and re-apply:

```sh
docker stop postgres_agent && docker rm postgres_agent
docker volume rm postgres_agent_data
docker run ...   # repeat step 1
node ../agent_db/db-setup.cjs
```

---

## Application integration

The Nouf-ex backend uses agent_db through a single helper module:

```ts
// app/server/lib/agent-db.cts
import { newAgentDb } from './agent-db.cts';
const agent = newAgentDb();
const hits = await agent.searchKnowledge('n+UF-EX');
```

The helper:
- Reads `AGENT_DATABASE_URL` (or the `AGENT_DB_*` discrete vars).
- Reuses the same `PgDb` wrapper as `noufex_db` (consistency).
- Logs all queries through the same structured logger (`request_id`
  propagates from the Express request into the agent log line).
- Fails open on transient errors — a knowledge lookup that returns
  nothing must never block a customer-facing request.
