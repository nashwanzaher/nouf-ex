/**
 * Database introspection tools for the Nouf-ex MCP server.
 *
 * All tools default to read-only behaviour against `noufex_db`. The
 * `query_database` tool is the only one that accepts arbitrary SQL — it
 * refuses statements outside an allow-list (SELECT / WITH / EXPLAIN /
 * SHOW) unless `read_only=false` is passed.
 */
import { z } from 'zod';
import pg from 'pg';
import type { ProjectContext } from './project.js';

type ToolHandler = (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;

interface ToolSpec {
	name: string;
	description: string;
	schema: z.ZodTypeAny;
	handler: ToolHandler;
}

/** Escape a literal so it can be embedded safely in a SQL identifier. */
function ident(name: string): string {
	return '"' + name.replace(/"/g, '""') + '"';
}

function asText(payload: unknown): string {
	if (typeof payload === 'string') return payload;
	return JSON.stringify(payload, null, 2);
}

/** Reject multi-statement input — pg.Pool.query only runs one anyway, but
 *  we want to be explicit. */
function isSafeReadOnlySql(sql: string): { ok: true } | { ok: false; reason: string } {
	const trimmed = sql.trim().replace(/;\s*$/, '');
	// Reject multi-statements (anything after the first `;` that isn't trailing whitespace).
	if (/;[^;]*\S/.test(trimmed + ';')) {
		return { ok: false, reason: 'multi-statement queries are not allowed' };
	}
	// Strip line comments and block comments before checking.
	const stripped = trimmed
		.replace(/--[^\n]*/g, '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.trim()
		.toUpperCase();
	if (
		!stripped.startsWith('SELECT') &&
		!stripped.startsWith('WITH') &&
		!stripped.startsWith('EXPLAIN') &&
		!stripped.startsWith('SHOW')
	) {
		return {
			ok: false,
			reason: 'only SELECT/WITH/EXPLAIN/SHOW are allowed in read-only mode',
		};
	}
	return { ok: true };
}

export function buildDbTools(ctx: ProjectContext): ToolSpec[] {
	// A fresh pool per call would be wasteful; share one connection pool
	// and let `pg` manage concurrency.
	const pool = new pg.Pool({ connectionString: ctx.databaseUrl, max: 4 });

	const listTables: ToolSpec = {
		name: 'db_list_tables',
		description:
			'List all base tables in the noufex_db public schema, with approximate row counts and disk size.',
		schema: z.object({}),
		handler: async () => {
			const r = await pool.query(`
				SELECT
					c.relname AS table_name,
					pg_catalog.pg_get_userbyid(c.relowner) AS owner,
					pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
					COALESCE(s.n_live_tup, 0)::bigint AS row_estimate,
					obj_description(c.oid, 'pg_class') AS comment
				FROM pg_class c
				JOIN pg_namespace n ON n.oid = c.relnamespace
				LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
				WHERE c.relkind IN ('r', 'p')
				  AND n.nspname = 'public'
				ORDER BY c.relname;
			`);
			return { content: [{ type: 'text', text: asText(r.rows) }] };
		},
	};

	const describeTable: ToolSpec = {
		name: 'db_describe_table',
		description:
			'Describe a single table: columns, types, nullability, defaults, CHECK constraints, indexes, and FK references.',
		schema: z.object({
			table: z.string().min(1).describe('Table name (case-sensitive, no schema)'),
		}),
		handler: async (args) => {
			const { table } = args as { table: string };
			const t = ident(table);
			const cols = await pool.query(
				`SELECT column_name, data_type, udt_name, is_nullable, column_default,
				        character_maximum_length, numeric_precision, numeric_scale
				   FROM information_schema.columns
				  WHERE table_schema = 'public' AND table_name = $1
				  ORDER BY ordinal_position`,
				[table]
			);
			if (cols.rowCount === 0) {
				return { content: [{ type: 'text', text: `Table ${table} not found.` }] };
			}
			const checks = await pool.query(
				`SELECT conname, pg_get_constraintdef(c.oid) AS definition
				   FROM pg_constraint c
				   JOIN pg_namespace n ON n.oid = c.connamespace
				   JOIN pg_class cl ON cl.oid = c.conrelid
				  WHERE cl.relname = $1 AND n.nspname = 'public' AND c.contype = 'c'`,
				[table]
			);
			const indexes = await pool.query(
				`SELECT indexname, indexdef
				   FROM pg_indexes
				  WHERE schemaname = 'public' AND tablename = $1
				  ORDER BY indexname`,
				[table]
			);
			const fks = await pool.query(
				`SELECT tc.constraint_name,
				        kcu.column_name,
				        ccu.table_schema AS foreign_table_schema,
				        ccu.table_name   AS foreign_table_name,
				        ccu.column_name  AS foreign_column_name,
				        rc.update_rule,
				        rc.delete_rule
				   FROM information_schema.table_constraints tc
				   JOIN information_schema.key_column_usage kcu
				     ON tc.constraint_name = kcu.constraint_name
				    AND tc.table_schema    = kcu.table_schema
				   JOIN information_schema.constraint_column_usage ccu
				     ON ccu.constraint_name = tc.constraint_name
				    AND ccu.table_schema    = tc.table_schema
				   JOIN information_schema.referential_constraints rc
				     ON rc.constraint_name = tc.constraint_name
				  WHERE tc.constraint_type = 'FOREIGN KEY'
				    AND tc.table_schema = 'public'
				    AND tc.table_name   = $1`,
				[table]
			);
			return {
				content: [
					{
						type: 'text',
						text: asText({
							table,
							columns: cols.rows,
							checks: checks.rows,
							indexes: indexes.rows,
							foreign_keys: fks.rows,
						}),
					},
				],
			};
		},
	};

	const listViews: ToolSpec = {
		name: 'db_list_views',
		description: 'List all views in the public schema with their definitions and security mode.',
		schema: z.object({}),
		handler: async () => {
			const r = await pool.query(`
				SELECT c.relname AS view_name,
				       pg_get_viewdef(c.oid, true) AS definition,
				       c.relispopulated AS is_populated,
				       c.relrowsecurity AS row_security,
				       obj_description(c.oid, 'pg_class') AS comment
				  FROM pg_class c
				  JOIN pg_namespace n ON n.oid = c.relnamespace
				 WHERE c.relkind IN ('v', 'm')
				   AND n.nspname = 'public'
				 ORDER BY c.relname;
			`);
			// Trim definitions for readability.
			const rows = r.rows.map((row) => ({ ...row, definition: row.definition?.slice(0, 800) }));
			return { content: [{ type: 'text', text: asText(rows) }] };
		},
	};

	const listFunctions: ToolSpec = {
		name: 'db_list_functions',
		description:
			'List PL/pgSQL functions in the public schema (the trigger functions used by the schema).',
		schema: z.object({}),
		handler: async () => {
			const r = await pool.query(`
				SELECT n.nspname AS schema,
				       p.proname AS name,
				       pg_get_function_identity_arguments(p.oid) AS args,
				       pg_get_function_result(p.oid) AS returns,
				       l.lanname AS language,
				       p.prosecdef AS security_definer,
				       obj_description(p.oid, 'pg_proc') AS comment
				  FROM pg_proc p
				  JOIN pg_namespace n ON n.oid = p.pronamespace
				  JOIN pg_language  l ON l.oid = p.prolanguage
				 WHERE n.nspname = 'public'
				 ORDER BY p.proname;
			`);
			return { content: [{ type: 'text', text: asText(r.rows) }] };
		},
	};

	const listTriggers: ToolSpec = {
		name: 'db_list_triggers',
		description: 'List triggers with the table they fire on and the function they call.',
		schema: z.object({}),
		handler: async () => {
			const r = await pool.query(`
				SELECT t.tgname AS trigger_name,
				       c.relname AS table_name,
				       (SELECT p.proname FROM pg_proc p WHERE p.oid = t.tgfoid) AS function_name,
				       t.tgenabled AS enabled,
				       t.tgtype    AS type_bits,
				       pg_get_triggerdef(t.oid) AS definition
				  FROM pg_trigger t
				  JOIN pg_class c ON c.oid = t.tgrelid
				  JOIN pg_namespace n ON n.oid = c.relnamespace
				 WHERE NOT t.tgisinternal
				   AND n.nspname = 'public'
				 ORDER BY c.relname, t.tgname;
			`);
			return { content: [{ type: 'text', text: asText(r.rows) }] };
		},
	};

	const getMigrations: ToolSpec = {
		name: 'db_get_migrations',
		description: 'List applied migrations from schema_migrations, in order.',
		schema: z.object({}),
		handler: async () => {
			const r = await pool.query(
				'SELECT version, description, applied_at FROM schema_migrations ORDER BY version'
			);
			return { content: [{ type: 'text', text: asText(r.rows) }] };
		},
	};

	const queryDb: ToolSpec = {
		name: 'db_query',
		description:
			'Run a read-only SQL query against noufex_db. Use SELECT/WITH/EXPLAIN/SHOW. Pass read_only=false to allow writes (rare).',
		schema: z.object({
			sql: z.string().min(1).max(20_000).describe('SQL query to run'),
			params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
			read_only: z.boolean().optional().default(true),
			max_rows: z.number().int().positive().optional().default(500),
		}),
		handler: async (args) => {
			const { sql, params, read_only, max_rows } = args as {
				sql: string;
				params?: unknown[];
				read_only?: boolean;
				max_rows?: number;
			};
			if (read_only !== false) {
				const verdict = isSafeReadOnlySql(sql);
				if (!verdict.ok) {
					return {
						content: [
							{
								type: 'text',
								text: `Refused: ${verdict.reason}. Set read_only=false to override.`,
							},
						],
					};
				}
			}
			const r = await pool.query({
				text: sql,
				values: params ?? [],
				rowMode: 'array',
			});
			const limit = max_rows ?? 500;
			const rows = r.rows.slice(0, limit);
			return {
				content: [
					{
						type: 'text',
						text: asText({
							rows,
							row_count: r.rowCount,
							fields: r.fields.map((f) => ({ name: f.name, dataType: f.dataTypeID })),
							truncated: (r.rowCount ?? 0) > limit,
						}),
					},
				],
			};
		},
	};

	const sampleRows: ToolSpec = {
		name: 'db_sample_rows',
		description: 'Fetch a small sample of rows from a table for quick eyeballing.',
		schema: z.object({
			table: z.string().min(1),
			limit: z.number().int().positive().optional().default(10),
			where: z.string().optional().describe('Optional WHERE clause (without the WHERE keyword)'),
		}),
		handler: async (args) => {
			const { table, limit, where } = args as { table: string; limit?: number; where?: string };
			let sql = `SELECT * FROM ${ident(table)}`;
			const params: unknown[] = [];
			if (where) {
				sql += ` WHERE ${where}`;
			}
			sql += ` LIMIT $${params.length + 1}`;
			params.push(limit ?? 10);
			const r = await pool.query({ text: sql, values: params });
			return { content: [{ type: 'text', text: asText(r.rows) }] };
		},
	};

	const dbStats: ToolSpec = {
		name: 'db_stats',
		description: 'High-level stats: total table count, view count, function count, total size.',
		schema: z.object({}),
		handler: async () => {
			const counts = await pool.query(`
				SELECT
				  (SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
				     WHERE c.relkind IN ('r','p') AND n.nspname='public') AS tables,
				  (SELECT COUNT(*) FROM pg_views WHERE schemaname='public') AS views,
				  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
				     WHERE n.nspname='public') AS functions,
				  (SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
				     JOIN pg_namespace n ON n.oid=c.relnamespace
				     WHERE NOT t.tgisinternal AND n.nspname='public') AS triggers,
				  pg_size_pretty(SUM(pg_total_relation_size(c.oid))::bigint) AS total_size
				FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
				WHERE c.relkind IN ('r','p') AND n.nspname='public';
			`);
			return { content: [{ type: 'text', text: asText(counts.rows[0]) }] };
		},
	};

	return [
		dbStats,
		listTables,
		describeTable,
		listViews,
		listFunctions,
		listTriggers,
		getMigrations,
		sampleRows,
		queryDb,
	];
}
