#!/usr/bin/env node
/**
 * reset-rate-limit.cjs — reset the API rate-limit buckets.
 * Used between phase runs to avoid the 20-req / 15-min auth cap.
 */
const path = require('path');
const Module = require('module');

const appRoot = path.resolve(__dirname, '../../app');
const appNodeModules = path.join(appRoot, 'node_modules');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
	try {
		return origResolve.call(this, request, parent, ...rest);
	} catch (e) {
		return origResolve.call(
			this,
			request,
			{ ...parent, paths: [appNodeModules, appRoot] },
			...rest
		);
	}
};

require(path.join(appNodeModules, 'dotenv')).config({
	path: path.join(appRoot, '.env'),
});
const { Pool } = require(path.join(appNodeModules, 'pg'));

// The .env points DB_HOST at host.docker.internal — that only resolves
// inside a Docker container. From the host we connect via localhost
// using the postgres superuser password.
const connStr =
	process.env.DB_PASSWORD && process.env.DB_NAME
		? `postgresql://postgres:${process.env.DB_PASSWORD}@localhost:5432/${process.env.DB_NAME}`
		: process.env.DATABASE_URL;

(async () => {
	const pool = new Pool({ connectionString: connStr });
	try {
		const r = await pool.query('DELETE FROM rate_limit_buckets');
		console.log(`[reset-rate-limit] deleted ${r.rowCount} bucket row(s) (all buckets)`);
		const c = await pool.query('SELECT count(*)::int AS n FROM rate_limit_buckets');
		console.log(`[reset-rate-limit] remaining total: ${c.rows[0].n}`);
	} catch (e) {
		console.error('[reset-rate-limit] FAILED:', e.message);
		process.exitCode = 1;
	} finally {
		await pool.end();
	}
})();
