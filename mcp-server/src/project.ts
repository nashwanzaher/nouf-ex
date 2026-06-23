/**
 * Project paths and configuration for the Nouf-ex MCP server.
 *
 * The MCP server is started with two positional CLI args:
 *   1. The project root (an absolute path to the Nouf-ex workspace).
 *   2. An optional database URL (defaults to `process.env.DATABASE_URL`).
 *
 * It reads `.env` from the project root for DB credentials when no URL is
 * passed. The server is read-only against the DB except for the
 * `query_database` tool, which can be configured to allow writes.
 */
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

export interface ProjectContext {
	root: string;
	databaseUrl: string;
	paths: {
		app: string;
		server: string;
		database: string;
		docs: string;
		apiServerTs: string;
		middlewareTs: string;
		dbWrapper: string;
	};
}

function arg(name: string, fallback?: string): string | undefined {
	const idx = process.argv.indexOf(name);
	if (idx === -1) return fallback;
	return process.argv[idx + 1];
}

function lastArg(): string | undefined {
	return process.argv[process.argv.length - 1];
}

/** Resolve the project root — either `--root <path>` or first non-flag arg. */
function resolveRoot(): string {
	const fromFlag = arg('--root');
	if (fromFlag) return path.resolve(fromFlag);
	const tail = lastArg();
	if (tail && !tail.startsWith('--') && fs.existsSync(tail)) {
		return path.resolve(tail);
	}
	// Fall back to the parent of the MCP server folder.
	return path.resolve(process.cwd(), '..');
}

function resolveDbUrl(root: string): string {
	dotenv.config({ path: path.join(root, '.env'), quiet: true });
	const fromFlag = arg('--db-url') ?? arg('--database-url');
	if (fromFlag) return fromFlag;
	const u = process.env.DATABASE_URL;
	if (u) return u;
	const host = process.env.DB_HOST;
	const port = process.env.DB_PORT || '5432';
	const name = process.env.DB_NAME;
	const user = process.env.DB_USER;
	const pass = process.env.DB_PASSWORD;
	if (host && name && user && pass) {
		return `postgresql://${user}:${pass}@${host}:${port}/${name}`;
	}
	throw new Error(
		'No database connection info found. Set DATABASE_URL in .env ' +
			'or pass --db-url postgresql://user:pass@host:port/db'
	);
}

export function loadProject(): ProjectContext {
	const root = resolveRoot();
	const databaseUrl = resolveDbUrl(root);
	return {
		root,
		databaseUrl,
		paths: {
			app: path.join(root, 'app'),
			server: path.join(root, 'app', 'server'),
			database: path.join(root, 'database'),
			docs: path.join(root, 'docs'),
			apiServerTs: path.join(root, 'app', 'server', 'index.ts'),
			middlewareTs: path.join(root, 'app', 'server', 'middleware.ts'),
			dbWrapper: path.join(root, 'app', 'server', 'db', 'pg-wrapper.cjs'),
		},
	};
}
