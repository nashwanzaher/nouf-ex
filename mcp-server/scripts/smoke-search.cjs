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
		pending.set(msgId, { resolve, reject });
		setTimeout(() => pending.has(msgId) && (pending.delete(msgId), reject(new Error('timeout'))), 8000);
	});
}
child.stdout.on('data', (chunk) => {
	buffer += chunk.toString();
	let nl;
	while ((nl = buffer.indexOf('\n')) !== -1) {
		const line = buffer.slice(0, nl);
		buffer = buffer.slice(nl + 1);
		if (!line.trim()) continue;
		try {
			const msg = JSON.parse(line);
			if (msg.id != null && pending.has(msg.id)) {
				const { resolve } = pending.get(msg.id);
				pending.delete(msg.id);
				resolve(msg);
			}
		} catch {}
	}
});

(async () => {
	await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'dbg', version: '0' } });
	child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

	for (const args of [
		{ pattern: 'requireAuth' },
		{ pattern: 'requireAuth', include: 'app/server/**/*.ts' },
		{ pattern: 'requireAuth', include: 'app/**' },
		{ pattern: 'requireAuth', include: 'app/**.ts' },
		{ pattern: 'requireAuth', include: 'app/server' },
	]) {
		const r = await send('tools/call', { name: 'code_search', arguments: args });
		const txt = r.result?.content?.[0]?.text ?? '';
		console.log('args =', JSON.stringify(args), '=>', txt.slice(0, 200));
	}
	child.kill();
})().catch((e) => { console.error(e); child.kill(); process.exit(1); });
