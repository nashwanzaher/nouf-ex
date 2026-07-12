#!/usr/bin/env node
/**
 * Nouf-ex MCP server — entrypoint.
 *
 * Starts a stdio MCP server that exposes three tool families:
 *
 *   • db_*    — introspection of the noufex_db PostgreSQL database
 *   • code_*  — navigation of the project source tree
 *   • api_*   — extraction of Express routes from app/server/index.ts
 *   • docs_*  — search and read of docs/*.md
 *
 * Usage:
 *   npx tsx src/index.ts                       # auto-detect project root
 *   npx tsx src/index.ts --root d:\source\Nouf-ex
 *   node dist/index.js                         # after `npm run build`
 *
 * The server is intentionally read-only against the database; the
 * `db_query` tool only accepts SELECT/WITH/EXPLAIN/SHOW unless the caller
 * passes `read_only: false`.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadProject } from './project.js';
import { buildDbTools } from './db-tools.js';
import { buildCodeTools } from './code-tools.js';
import { buildApiTools } from './api-tools.js';
import { buildDocsTools } from './docs-tools.js';

async function main() {
	const ctx = loadProject();

	const server = new McpServer(
		{
			name: 'noufex-mcp',
			version: '0.1.0',
		},
		{
			capabilities: {},
			instructions: [
				'You are connected to the Nouf-ex project at ' + ctx.root + '.',
				'Use db_* tools to query noufex_db, code_* to navigate source,',
				'api_* to inspect Express routes, and docs_* to read the docs.',
			].join(' '),
		},
	);

	for (const tool of [...buildDbTools(ctx), ...buildCodeTools(ctx), ...buildApiTools(ctx), ...buildDocsTools(ctx)]) {
		// The MCP SDK expects a ZodRawShape (the `.shape` of a ZodObject).
		// All of our tools use z.object(), so this is always present.
		const shape = (tool.schema as z.ZodObject<z.ZodRawShape>).shape;
		server.tool(tool.name, tool.description, shape, async (args) => tool.handler(args));
	}

	const transport = new StdioServerTransport();
	await server.connect(transport);

	// Friendly stderr greeting so a developer can see the server started.
	process.stderr.write(`[noufex-mcp] ready · root=${ctx.root} · db=${ctx.databaseUrl.replace(/:[^:@/]+@/, ':***@')}\n`);
}

main().catch((err) => {
	process.stderr.write(`[noufex-mcp] fatal: ${err?.stack ?? err}\n`);
	process.exit(1);
});
