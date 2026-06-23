# noufex-mcp

A Model Context Protocol server for deep, accurate inspection of the
**Nouf-ex** project and its PostgreSQL database (`noufex_db`).

The server exposes four families of tools over `stdio`:

| Family   | Tools                                                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **db**   | `db_stats`, `db_list_tables`, `db_describe_table`, `db_list_views`, `db_list_functions`, `db_list_triggers`, `db_get_migrations`, `db_sample_rows`, `db_query` |
| **code** | `code_tree`, `code_read_file`, `code_search`                                                                                                                   |
| **api**  | `api_list_endpoints`, `api_get_endpoint`, `api_search`                                                                                                         |
| **docs** | `docs_list`, `docs_read`, `docs_search`                                                                                                                        |

The DB tools are **read-only by default** — `db_query` accepts only
`SELECT` / `WITH` / `EXPLAIN` / `SHOW` unless the caller passes
`read_only: false`.

---

## Quick start

```sh
cd mcp-server
npm install
npm run build          # one-time — produces dist/index.js
```

Then register it in `.vscode/mcp.json` (already provided in this workspace):

```jsonc
{
	"servers": {
		"noufex": {
			"type": "stdio",
			"command": "node",
			"args": ["${workspaceFolder}/mcp-server/dist/index.js", "--root", "${workspaceFolder}"],
		},
	},
}
```

After saving, VS Code will start the server the next time an MCP-aware
agent connects. Use `MCP: List Servers` and **Start** the `noufex`
entry from the command palette to verify.

For ad-hoc testing:

```sh
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | node mcp-server/dist/index.js --root .
```

(you'll need to send a real MCP framing header; `tsx` + a small script is
easier — see `scripts/smoke-mcp.ts`.)

---

## Tool reference (selected)

### `db_describe_table`

Returns columns (with types, nullability, defaults), CHECK constraints,
indexes, and foreign keys for a single table.

```jsonc
{
	"name": "db_describe_table",
	"arguments": { "table": "products" },
}
```

### `db_query`

Runs arbitrary SQL. Defaults to read-only mode; pass `read_only: false`
to allow writes.

```jsonc
{
	"name": "db_query",
	"arguments": {
		"sql": "SELECT id, name_ar, price FROM products WHERE is_active = TRUE ORDER BY price DESC LIMIT 5",
		"max_rows": 10,
	},
}
```

### `api_list_endpoints`

Returns every Express route from `app/server/index.ts` with verb, path,
auth requirement, and source line.

```jsonc
{ "name": "api_list_endpoints", "arguments": { "method": "GET" } }
```

### `api_get_endpoint`

Returns the same metadata plus a numbered source excerpt.

```jsonc
{
	"name": "api_get_endpoint",
	"arguments": { "method": "GET", "path": "/api/products/:id", "context_lines": 30 },
}
```

### `code_search`

Regex search across source files. Use `include` / `exclude` globs.

```jsonc
{
	"name": "code_search",
	"arguments": {
		"pattern": "requireAuth|requireRole",
		"include": "app/server/**/*.ts",
		"exclude": "**/*.test.ts",
	},
}
```

### `docs_read`

Reads a single markdown file from `docs/`.

```jsonc
{ "name": "docs_read", "arguments": { "path": "docs/architecture.md" } }
```

---

## Configuration

The server resolves the project root and the database URL in this order:

1. CLI flag `--root <path>` (defaults to the parent of `cwd`).
2. CLI flag `--db-url <connection string>`.
3. Environment variables `DATABASE_URL` (or `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`).

`.env` from the project root is loaded automatically when present.

---

## Security notes

- All filesystem tools validate that the resolved path stays inside the
  project root.
- DB connection details are redacted (`password → ***`) in any stderr /
  log output.
- The default safety stance for `db_query` is read-only — explicit
  override is required to run `INSERT/UPDATE/DELETE/DDL`.
- No external HTTP calls are made by the server.

---

## Files

```
mcp-server/
├── README.md              ← this file
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts           ← MCP entrypoint, tool registration
    ├── project.ts         ← CLI/env → ProjectContext
    ├── db-tools.ts        ← db_* tools
    ├── code-tools.ts      ← code_* tools
    ├── api-tools.ts       ← api_* tools (parses app/server/index.ts)
    └── docs-tools.ts      ← docs_* tools (walks docs/)
```
