/**
 * Code-introspection tools for the Nouf-ex MCP server.
 *
 * These tools help an LLM navigate the codebase by:
 *   - listing the directory tree
 *   - searching source files for a regex
 *   - reading any file under the project root
 *   - enumerating every HTTP route declared in `apps/api/src/index.ts`
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

function listDir(root: string, dir: string, maxEntries: number): string[] {
	const abs = safeResolve(root, dir);
	if (!fs.existsSync(abs)) return [];
	const out: string[] = [];
	const stack = [abs];
	while (stack.length && out.length < maxEntries) {
		const cur = stack.pop()!;
		let stat: fs.Stats;
		try {
			stat = fs.statSync(cur);
		} catch {
			continue;
		}
		if (stat.isDirectory()) {
			let entries: fs.Dirent[];
			try {
				entries = fs.readdirSync(cur, { withFileTypes: true });
			} catch {
				continue;
			}
			const rel = path.relative(root, cur) || '.';
			for (const e of entries) {
				if (e.name.startsWith('.') && e.name !== '.env.example') continue;
				if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'coverage') continue;
				const child = path.join(cur, e.name);
				out.push(path.join(rel, e.name) + (e.isDirectory() ? '/' : ''));
				if (e.isDirectory()) stack.push(child);
			}
		}
	}
	out.sort();
	return out.slice(0, maxEntries);
}

export function buildCodeTools(ctx: ProjectContext): ToolSpec[] {
	const { root } = ctx;

	const tree: ToolSpec = {
		name: 'code_tree',
		description:
			'List files under a directory (relative to the project root). Skips node_modules / dist / coverage / dotfiles.',
		schema: z.object({
			path: z
				.string()
				.optional()
				.default('.')
				.describe('Directory path relative to the project root.'),
			max_entries: z.number().int().positive().optional().default(400),
		}),
		handler: async (args) => {
			const { path: p, max_entries } = args as { path: string; max_entries?: number };
			const files = listDir(root, p, max_entries ?? 400);
			return { content: [{ type: 'text', text: asText({ path: p, files }) }] };
		},
	};

	const read: ToolSpec = {
		name: 'code_read_file',
		description:
			'Read a source file under the project root. Returns the file content with line numbers.',
		schema: z.object({
			path: z.string().describe('File path relative to the project root.'),
			max_bytes: z.number().int().positive().optional().default(200_000),
		}),
		handler: async (args) => {
			const { path: p, max_bytes } = args as { path: string; max_bytes?: number };
			const abs = safeResolve(root, p);
			if (!fs.existsSync(abs)) {
				return { content: [{ type: 'text', text: `File not found: ${p}` }] };
			}
			const stat = fs.statSync(abs);
			if (stat.isDirectory()) {
				return { content: [{ type: 'text', text: `${p} is a directory.` }] };
			}
			const raw = fs.readFileSync(abs, 'utf8');
			const text = raw.length > max_bytes! ? raw.slice(0, max_bytes!) + '\n…(truncated)' : raw;
			const numbered = text
				.split('\n')
				.map((line, i) => `${String(i + 1).padStart(5, ' ')} │ ${line}`)
				.join('\n');
			return { content: [{ type: 'text', text: numbered }] };
		},
	};

	const search: ToolSpec = {
		name: 'code_search',
		description:
			'Search source files for a regex. Returns up to max_results matching lines with file paths and 1-based line numbers.',
		schema: z.object({
			pattern: z.string().min(1).describe('Regex or literal string.'),
			include: z.string().optional().describe('Glob to restrict (e.g. apps/api/src/**/*.ts).'),
			exclude: z.string().optional().describe('Glob to exclude (e.g. **/*.test.ts).'),
			max_results: z.number().int().positive().optional().default(60),
			context: z
				.number()
				.int()
				.min(0)
				.optional()
				.default(1)
				.describe('Lines of context after each match.'),
		}),
		handler: async (args) => {
			const { pattern, include, exclude, max_results, context } = args as {
				pattern: string;
				include?: string;
				exclude?: string;
				max_results?: number;
				context?: number;
			};
			const re = new RegExp(pattern, 'i');
			const includeRe = include ? globToRegex(include) : null;
			const excludeRe = exclude ? globToRegex(exclude) : null;
			const hits: { file: string; line: number; text: string; context: string[] }[] = [];
			const stack: string[] = [root];
			while (stack.length && hits.length < max_results!) {
				const dir = stack.pop()!;
				let entries: fs.Dirent[];
				try {
					entries = fs.readdirSync(dir, { withFileTypes: true });
				} catch {
					continue;
				}
				for (const entry of entries) {
					if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage')
						continue;
					const child = path.join(dir, entry.name);
					if (entry.isDirectory()) stack.push(child);
					else if (entry.isFile()) {
						const rel = path.relative(root, child).replace(/\\/g, '/');
						if (includeRe && !includeRe.test(rel)) continue;
						if (excludeRe && excludeRe.test(rel)) continue;
						let text: string;
						try {
							text = fs.readFileSync(child, 'utf8');
						} catch {
							continue;
						}
						const lines = text.split('\n');
						for (let i = 0; i < lines.length; i++) {
							if (re.test(lines[i]!)) {
								const ctx: string[] = [];
								for (let j = 1; j <= (context ?? 1); j++) {
									if (lines[i + j]) ctx.push(lines[i + j]!);
								}
								hits.push({
									file: rel,
									line: i + 1,
									text: lines[i]!,
									context: ctx,
								});
								if (hits.length >= max_results!) break;
							}
						}
					}
				}
			}
			return { content: [{ type: 'text', text: asText({ pattern, count: hits.length, hits }) }] };
		},
	};

	return [tree, read, search];
}

/** Convert a small subset of glob syntax to a regex (used only for include/exclude). */
function globToRegex(glob: string): RegExp {
	// Substitute glob wildcards with sentinel tokens first so they survive
	// the regex-escape pass.
	const STAR_STAR_SLASH = '\x00SS\x00';
	const STAR_STAR = '\x00S\x00';
	const STAR = '\x00s\x00';
	const QMARK = '\x00q\x00';
	const out = glob
		.replace(/\*\*\//g, STAR_STAR_SLASH)
		.replace(/\*\*/g, STAR_STAR)
		.replace(/\*/g, STAR)
		.replace(/\?/g, QMARK)
		// Escape every regex special char EXCEPT our sentinels.
		.replace(/[.+^${}()|[\]\\]/g, '\\$&')
		// Now expand sentinels.
		.replace(new RegExp(STAR_STAR_SLASH, 'g'), '(?:.*/)?')
		.replace(new RegExp(STAR_STAR, 'g'), '.*')
		.replace(new RegExp(STAR, 'g'), '[^/]*')
		.replace(new RegExp(QMARK, 'g'), '[^/]');
	return new RegExp('^' + out + '$');
}
