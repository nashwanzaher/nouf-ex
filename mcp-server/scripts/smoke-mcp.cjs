#!/usr/bin/env node
/* eslint-disable */
// Minimal smoke test: start the MCP server, send initialize + tools/list
// + one tool call, then exit. Demonstrates the server works end-to-end
// without needing VS Code connected.
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const serverPath = path.resolve(__dirname, '..', 'dist', 'index.js');
const root = path.resolve(__dirname, '..', '..');

const child = spawn(process.execPath, [serverPath, '--root', root], {
	stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
let id = 0;
const pending = new Map();

function send(method, params = {}) {
	const msgId = ++id;
	const frame = JSON.stringify({ jsonrpc: '2.0', id: msgId, method, params }) + '\n';
	process.stdout.write(`→ ${method} (${msgId})\n`);
	child.stdin.write(frame);
	return new Promise((resolve, reject) => {
		pending.set(msgId, { resolve, reject, method });
		setTimeout(() => {
			if (pending.has(msgId)) {
				pending.delete(msgId);
				reject(new Error(`Timeout waiting for ${method}`));
			}
		}, 8000);
	});
}

child.stdout.on('data', (chunk) => {
	buffer += chunk.toString();
	let nl;
	while ((nl = buffer.indexOf('\n')) !== -1) {
		const line = buffer.slice(0, nl);
		buffer = buffer.slice(nl + 1);
		if (!line.trim()) continue;
		let msg;
		try {
			msg = JSON.parse(line);
		} catch {
			process.stdout.write(`?  ${line}\n`);
			continue;
		}
		if (msg.id != null && pending.has(msg.id)) {
			const { resolve, method } = pending.get(msg.id);
			pending.delete(msg.id);
			process.stdout.write(`← ${method} result\n`);
			resolve(msg);
		} else if (msg.id != null) {
			process.stdout.write(`← (late) ${JSON.stringify(msg).slice(0, 200)}\n`);
		}
	}
});

child.stderr.on('data', (chunk) => {
	process.stderr.write(`[server] ${chunk}`);
});

child.on('exit', (code) => {
	process.stderr.write(`[server] exited with code ${code}\n`);
});

async function main() {
	// 1) initialize
	const init = await send('initialize', {
		protocolVersion: '2024-11-05',
		capabilities: {},
		clientInfo: { name: 'smoke-mcp', version: '0.1.0' },
	});
	process.stdout.write(`  server: ${init.result?.serverInfo?.name ?? '?'}\n`);
	child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

	// 2) list tools
	const tools = await send('tools/list', {});
	const list = tools.result?.tools ?? [];
	process.stdout.write(`  tools: ${list.length} registered\n`);
	list.forEach((t) => process.stdout.write(`    · ${t.name}\n`));

	// 3) call db_stats (no params)
	const stats = await send('tools/call', { name: 'db_stats', arguments: {} });
	process.stdout.write(`  db_stats: ${JSON.stringify(stats.result).slice(0, 400)}\n`);

	// 4) call db_list_tables
	const tables = await send('tools/call', { name: 'db_list_tables', arguments: {} });
	const txt = tables.result?.content?.[0]?.text ?? '';
	const arr = JSON.parse(txt);
	process.stdout.write(`  db_list_tables: ${arr.length} tables\n`);

	// 5) call db_describe_table for products
	const desc = await send('tools/call', {
		name: 'db_describe_table',
		arguments: { table: 'products' },
	});
	const dtext = desc.result?.content?.[0]?.text ?? '';
	const darr = JSON.parse(dtext);
	process.stdout.write(`  db_describe_table(products): ${darr.columns.length} columns\n`);

	// 6) api_list_endpoints GET
	const ep = await send('tools/call', { name: 'api_list_endpoints', arguments: { method: 'GET' } });
	const etext = ep.result?.content?.[0]?.text ?? '';
	const earr = JSON.parse(etext);
	process.stdout.write(`  api_list_endpoints(GET): ${earr.length} GET routes\n`);

	process.stdout.write('OK\n');
	child.kill();
}

main().catch((e) => {
	process.stderr.write(`FAIL: ${e?.stack ?? e}\n`);
	child.kill();
	process.exit(1);
});
