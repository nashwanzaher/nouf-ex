# noufex-mcp

A Model Context Protocol (MCP) server for deep, accurate inspection of the
**Nouf-ex** project and its PostgreSQL database (`noufex_db`) — designed
for AI agents (GitHub Copilot, Claude, etc.) that need to read this
codebase with the same fidelity as a human reviewer.

---

## Purpose

**noufex-mcp** is a read-only bridge between an LLM agent and three
sources of truth:

1. **The PostgreSQL schema** (`noufex_db`) — table definitions, indexes,
   triggers, views, roles, migration history, sample rows.
2. **The application source** (`app/server/`, `app/src/`, `database/`) —
   file tree, content with line numbers, regex search across the
   working tree.
3. **The REST API surface** (`app/server/index.ts`) — every Express
   route with verb, path, auth middleware heuristic, and source
   excerpt.

This lets an agent answer questions like:

- "Show me the orders table schema and the last 5 rows."
- "What endpoints require `admin` role?"
- "Which files reference `DATABASE_URL`?"
- "Read me the security middleware."
- "Search the source for `rate-limit` and show the surrounding code."

…without parsing the repo blindly or hallucinating endpoint names.

> **The server never modifies state by default.** All filesystem and DB
> tools are read-only. The one write-capable tool (`db_query`) refuses
> any non-`SELECT` statement unless the caller explicitly passes
> `read_only: false`.

---

## Quick start

### 1. Build the server

```sh
cd mcp-server
npm install
npm run build          # produces dist/index.js (CommonJS bundle)
```

### 2. Register with VS Code

The workspace already ships with `.vscode/mcp.json`:

```jsonc
{
 "servers": {
  "noufex": {
   "type": "stdio",
   "command": "node",
   "args": [
    "${workspaceFolder}/mcp-server/dist/index.js",
    "--root",
    "${workspaceFolder}",
   ],
  },
 },
}
```

After saving, VS Code will spawn the server the next time an MCP-aware
agent (GitHub Copilot Chat, Continue, Claude Desktop, etc.) connects.
Use **MCP: List Servers** from the command palette to verify the
`noufex` server appears, then **Start** it.

### 3. Smoke test

```sh
# Quick health check (server speaks MCP over stdio; send a tools/list):
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | node mcp-server/dist/index.js --root .

# Or run the smoke test script (no MCP framing required):
node mcp-server/scripts/smoke-mcp.cjs
```

The smoke test calls `db_stats`, `db_list_tables`, `db_describe_table`,
and `api_list_endpoints` and asserts each returns well-formed data.

---

## Tool reference (17 tools)

### `db_*` — Database inspection (9 tools)

| Tool | What it does | Returns |
|---|---|---|
| `db_stats` | Database overview | Table / view / function / trigger counts + total size |
| `db_list_tables` | All base tables in `public` | name, approximate row count, disk size |
| `db_describe_table` | Single table schema | columns, CHECK constraints, indexes, FK references |
| `db_list_views` | All views with definitions | name + first 80 chars of DDL + `security_invoker` setting |
| `db_list_functions` | PL/pgSQL functions in `public` | name, args, return type, volatility (helps understand triggers) |
| `db_list_triggers` | All triggers | table, function, event, timing |
| `db_get_migrations` | Applied migrations from `schema_migrations` | version, description, applied_at, checksum |
| `db_sample_rows` | Sample rows from a table | first N rows; optional WHERE clause |
| `db_query` | Run arbitrary SQL | **read-only by default**; pass `read_only: false` for writes |

> **Example — describe the orders table:**
>
> ```jsonc
> { "name": "db_describe_table", "arguments": { "table": "orders" } }
> ```

> **Example — search for high-value orders:**
>
> ```jsonc
> {
>   "name": "db_query",
>   "arguments": {
>     "sql": "SELECT id, order_number, total, status FROM orders WHERE total > 100000 ORDER BY total DESC LIMIT 5",
>   },
> }
> ```

### `code_*` — Source inspection (3 tools)

| Tool | What it does |
|---|---|
| `code_tree` | Returns the file tree under a path (skips `node_modules/`, `dist/`, `coverage/`) |
| `code_read_file` | Reads a file with line numbers (max 200 KB) |
| `code_search` | Regex search across files; supports `include`/`exclude` glob patterns |

> **Example — find every callsite of `requireRole`:**
>
> ```jsonc
> {
>   "name": "code_search",
>   "arguments": {
>     "pattern": "requireRole\\(",
>     "include": "app/server/**/*.cts",
>     "exclude": "**/*.test.ts",
>   },
> }
> ```

> **Example — read a route file with line numbers:**
>
> ```jsonc
> { "name": "code_read_file", "arguments": { "path": "app/server/routes/auth.cts" } }
> ```

> **Path safety:** `code_read_file` and `code_search` resolve every path
> against the project root and reject any result that escapes it (e.g.
> `../etc/passwd`). You cannot read files outside the workspace.

### `api_*` — REST API inspection (3 tools)

| Tool | What it does |
|---|---|
| `api_list_endpoints` | All Express routes from `app/server/index.ts` with verb, path, auth middleware |
| `api_get_endpoint` | One endpoint's metadata + numbered source excerpt |
| `api_search` | Search endpoints by path substring |

The middleware heuristic auto-detects:

- `requireAuth` → `authed`
- `requireRole('admin')` → `role:admin`
- `requireRole('merchant')` → `role:merchant`
- otherwise → `public`

Results are cached based on `mtime` so re-running during a session is
instant.

> **Example — every admin-only endpoint:**
>
> ```jsonc
> {
>   "name": "api_search",
>   "arguments": { "pattern": "/api/admin" },
> }
> ```

### `docs_*` — Documentation inspection (3 tools)

| Tool | What it does |
|---|---|
| `docs_list` | List every `.md` under `docs/` with size |
| `docs_read` | Read one doc (max 120 KB) |
| `docs_search` | Regex search across docs |

By default, `docs_list` excludes `research/` and `audit/`. Pass
`--include-research` or `--include-audit` to scan them.

---

## Configuration

The server resolves the project root and the database URL in this order
(first match wins):

1. **CLI flags**: `--root <path>` and `--db-url <connection string>`.
2. **Environment**: `DATABASE_URL`, or `DB_HOST` + `DB_PORT` + `DB_NAME` + `DB_USER` + `DB_PASSWORD`.
3. **`.env`** at the project root is auto-loaded when present.

Example:

```sh
node mcp-server/dist/index.js \
  --root /home/me/noufex \
  --db-url 'postgresql://noufex_app:CHANGE_ME_APP@localhost:5432/noufex_db'
```

---

## Common workflows

### "Review a PR that adds a new endpoint"

1. `api_list_endpoints` — see if the new route is registered.
2. `api_get_endpoint` for the new path — read its handler.
3. `code_search` for the route name — find all callsites + tests.
4. `db_describe_table` for any new tables it touches.
5. `db_list_triggers` — verify any state-machine triggers still cover the new transitions.

### "Debug a 500 error"

1. `db_describe_table` + `db_sample_rows` — inspect the relevant table.
2. `code_search` for the error message string.
3. `code_read_file` on the matching route file.

### "Check schema migrations are applied"

1. `db_get_migrations` — list all applied migrations.
2. `db_describe_table` on a table that the latest migration should have changed.

### "Find every place a constant is used"

1. `code_search` for the constant name (e.g. `AUTH_SECRET`).
2. `docs_search` to find documentation references.

---

## Security model

| Concern | Mitigation |
|---|---|
| Reading files outside the project root | `code_read_file` and `code_search` resolve paths against `--root` and reject anything that escapes it (verified with `path.relative`) |
| Accidental DB writes | `db_query` rejects anything that isn't `SELECT`/`WITH`/`EXPLAIN`/`SHOW` unless the caller passes `read_only: false`; multi-statement queries are rejected; `--` comments are stripped before pattern matching |
| Password leakage in logs | All `password=...` strings are replaced with `password=***` before any stderr/log output |
| External network calls | The server makes **zero** outbound HTTP requests; all data is local |
| Multi-statement SQL injection | Each query is checked for `;` outside of comments/strings before being passed to `pg` |

The server logs each tool invocation to **stderr** in one-line JSON.
Configure your log shipper to capture and forward these.

---

## Files

```
mcp-server/
├── README.md              ← this file
├── package.json
├── tsconfig.json
├── scripts/
│   ├── smoke-mcp.cjs            ← basic health check
│   ├── smoke-mcp-full.cjs       ← exercises every tool family
│   └── smoke-search.cjs        ← verifies code_search glob behaviour
└── src/
    ├── index.ts           ← MCP entrypoint, tool registration
    ├── project.ts         ← CLI/env → ProjectContext
    ├── db-tools.ts        ← db_* tools
    ├── code-tools.ts      ← code_* tools
    ├── api-tools.ts       ← api_* tools (parses app/server/index.ts)
    └── docs-tools.ts      ← docs_* tools (walks docs/)
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Server fails to start | `dist/index.js` missing | Run `npm run build` in `mcp-server/` |
| `db_describe_table` returns "relation does not exist" | table name in wrong schema | Default schema is `public`; pass `{ "schema": "other" }` if needed |
| `code_search` returns nothing | Include glob excludes too much | Drop `exclude` and re-run with just `include` |
| `api_list_endpoints` is empty | `app/server/index.ts` not at the configured `--root` | Verify the root path; the parser only walks this single file |
| "Permission denied" reading `pg_hba.conf` | DB user can't authenticate | The server uses the URL provided — fix `.env` or the `--db-url` flag |
| VS Code doesn't show the server | MCP extension not installed | Install **GitHub Copilot Chat** with MCP support, or another MCP client |
