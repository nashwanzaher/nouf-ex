/**
 * Documentation introspection tools for the Nouf-ex MCP server.
 *
 * Surfaces the contents of `docs/*.md` so an LLM can pull in the
 * architecture, getting-started, API reference, and audit reports on demand.
 */
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import type { ProjectContext } from './project.js';

type ToolHandler = (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;

interface ToolSpec {
	name: string;
	description: string;
	schema: z.ZodTypeAny;
	handler: ToolHandler;
}

function asText(payload: unknown): string {
	if (typeof payload === 'string') return payload;
	return JSON.stringify(payload, null, 2);
}

function safeResolve(root: string, rel: string): string {
	const abs = path.isAbsolute(rel) ? rel : path.resolve(root, rel);
	const normalized = path.normalize(abs);
	const normRoot = path.normalize(root) + path.sep;
	if (normalized !== path.normalize(root) && !normalized.startsWith(normRoot)) {
		throw new Error(`Path ${rel} is outside the project root`);
	}
	return normalized;
}

export function buildDocsTools(ctx: ProjectContext): ToolSpec[] {
	const { root, paths } = ctx;

	const list: ToolSpec = {
		name: 'docs_list',
		description: 'List every .md documentation file under docs/ with sizes.',
		schema: z.object({
			include_research: z.boolean().optional().default(false),
			include_audit: z.boolean().optional().default(false),
		}),
		handler: async (args) => {
			const { include_research, include_audit } = args as {
				include_research?: boolean;
				include_audit?: boolean;
			};
			const baseDir = paths.docs;
			const out: { path: string; bytes: number }[] = [];
			function walk(dir: string) {
				if (!fs.existsSync(dir)) return;
				for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
					const child = path.join(dir, entry.name);
					if (entry.isDirectory()) {
						if (entry.name === 'research' && !include_research) continue;
						if (entry.name === 'audit' && !include_audit) continue;
						walk(child);
					} else if (entry.isFile() && entry.name.endsWith('.md')) {
						const stat = fs.statSync(child);
						out.push({ path: path.relative(root, child).replace(/\\/g, '/'), bytes: stat.size });
					}
				}
			}
			walk(baseDir);
			out.sort((a, b) => a.path.localeCompare(b.path));
			return { content: [{ type: 'text', text: asText(out) }] };
		},
	};

	const read: ToolSpec = {
		name: 'docs_read',
		description: 'Read a documentation file (relative to project root, e.g. docs/architecture.md).',
		schema: z.object({
			path: z.string().describe('Doc file path relative to project root.'),
			max_bytes: z.number().int().positive().optional().default(120_000),
		}),
		handler: async (args) => {
			const { path: p, max_bytes } = args as { path: string; max_bytes?: number };
			const abs = safeResolve(root, p);
			if (!fs.existsSync(abs)) {
				return { content: [{ type: 'text', text: `Doc not found: ${p}` }] };
			}
			const text = fs.readFileSync(abs, 'utf8');
			const truncated =
				text.length > max_bytes! ? text.slice(0, max_bytes!) + '\n…(truncated)' : text;
			return { content: [{ type: 'text', text: truncated }] };
		},
	};

	const search: ToolSpec = {
		name: 'docs_search',
		description:
			'Search across docs/*.md for a literal phrase or regex; returns file + line + snippet.',
		schema: z.object({
			pattern: z.string().min(1),
			max_results: z.number().int().positive().optional().default(30),
		}),
		handler: async (args) => {
			const { pattern, max_results } = args as { pattern: string; max_results?: number };
			const re = new RegExp(pattern, 'i');
			const hits: { file: string; line: number; text: string }[] = [];
			function walk(dir: string) {
				if (!fs.existsSync(dir)) return;
				for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
					const child = path.join(dir, entry.name);
					if (entry.isDirectory()) walk(child);
					else if (entry.isFile() && entry.name.endsWith('.md')) {
						const rel = path.relative(root, child).replace(/\\/g, '/');
						const lines = fs.readFileSync(child, 'utf8').split('\n');
						for (let i = 0; i < lines.length; i++) {
							if (re.test(lines[i]!)) {
								hits.push({ file: rel, line: i + 1, text: lines[i]!.trim() });
								if (hits.length >= max_results!) return;
							}
						}
					}
				}
			}
			walk(paths.docs);
			return { content: [{ type: 'text', text: asText({ pattern, count: hits.length, hits }) }] };
		},
	};

	return [list, read, search];
}
