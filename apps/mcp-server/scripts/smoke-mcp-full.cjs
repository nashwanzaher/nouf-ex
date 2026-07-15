#!/usr/bin/env node
/* eslint-disable */
'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');

const serverPath = path.resolve(__dirname, '..', 'dist', 'index.js');
const root = path.resolve(__dirname, '..', '..');

const child = spawn(process.execPath, [serverPath, '--root', root], { stdio: ['pipe', 'pipe', 'pipe'] });

let buffer = '';
let id = 0;
const pending = new Map();

function send(method, params = {}) {
	const msgId = ++id;
	child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: msgId, method, params }) + '\n');
	return new Promise((resolve, reject) => {
		pending.set(msgId, { resolve, reject, method });
		setTimeout(() => pending.has(msgId) && (pending.delete(msgId), reject(new Error(`Timeout ${method}`))), 10_000);
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
		try { msg = JSON.parse(line); } catch { continue; }
		if (msg.id != null && pending.has(msg.id)) {
			const { resolve, method } = pending.get(msg.id);
			pending.delete(msg.id);
			resolve(msg);
		}
	}
});
child.stderr.on('data', () => {});

async function call(name, args = {}) {
	const r = await send('tools/call', { name, arguments: args });
	const txt = r.result?.content?.[0]?.text ?? '';
	if (r.result?.isError) {
		console.log(`  ✗ ${name}: ${txt.slice(0, 200)}`);
		return null;
	}
	console.log(`  ✓ ${name}: ${txt.slice(0, 160).replace(/\n/g, ' ')}…`);
	return txt;
}

async function main() {
	await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke-full', version: '0.1.0' } });
	child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

	console.log('--- DB tools ---');
	await call('db_list_views');
	await call('db_list_triggers');
	await call('db_get_migrations');
	await call('db_sample_rows', { table: 'products', limit: 2 });
	await call('db_query', { sql: "SELECT count(*)::int AS n FROM users WHERE role='merchant'" });
	await call('db_query', { sql: 'DROP TABLE x' }); // should be refused

	console.log('--- Code tools ---');
	await call('code_tree', { path: 'apps/web/src/pages' });
	await call('code_read_file', { path: 'apps/api/src/index.ts', max_bytes: 4000 });
	await call('code_search', { pattern: 'requireAuth', include: 'apps/api/src/**/*.ts' });

	console.log('--- API tools ---');
	await call('api_list_endpoints');
	await call('api_get_endpoint', { method: 'POST', path: '/api/reviews' });
	await call('api_search', { query: '/api/cart' });

	console.log('--- Docs tools ---');
	await call('docs_list');
	await call('docs_read', { path: 'docs/getting-started.md' });
	await call('docs_search', { pattern: 'scrypt' });

	console.log('OK');
	child.kill();
}
main().catch((e) => { console.error('FAIL:', e?.message ?? e); child.kill(); process.exit(1); });
