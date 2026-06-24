// filepath: scripts/drop-test-db.cjs
//
// Drop a test database safely (terminate connections first).
//
// The script REFUSES to run without an explicit database name. This
// is a deliberate safety measure: Nouf-ex uses `noufex_db` as its
// single production database, and we never want this script to be
// the path by which that database gets dropped by accident.
//
// Usage:
//   node scripts/drop-test-db.cjs <database_name>
//
// Example:
//   node scripts/drop-test-db.cjs noufex_db_test
//
// The script connects as the `postgres` superuser to the `postgres`
// maintenance database (where DROP DATABASE is allowed regardless of
// the target's own grants), terminates all backends on the target,
// then drops the database if it exists.
const path = require('node:path');
let Client;
try {
	({ Client } = require(path.join(__dirname, '..', 'app', 'node_modules', 'pg')));
} catch (err) {
	throw new Error(
		'Cannot resolve `pg` from app/node_modules. ' +
			'Run `cd app && npm install` first, then re-run this script.',
	);
}

const db = process.argv[2];

(async () => {
	if (!db) {
		console.error('Usage: node scripts/drop-test-db.cjs <database_name>');
		console.error('');
		console.error('Refusing to run without an explicit database name.');
		console.error('Nouf-ex uses `noufex_db` as its single database — passing');
		console.error('nothing (or a wrong name) would risk dropping the wrong one.');
		process.exit(2);
	}
	if (db === 'noufex_db') {
		console.error('Refusing to drop the production database (`noufex_db`).');
		console.error('If you really mean to do this, run DROP DATABASE manually');
		console.error('from psql. This script will not do it for you.');
		process.exit(2);
	}

	const c = new Client({
		connectionString:
			process.env.DATABASE_URL ||
			'postgresql://postgres:***REDACTED***@localhost:5432/postgres',
	});
	await c.connect();
	try {
		await c.query(
			`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
			[db],
		);
	} catch (_) {
		/* db might not exist */
	}
	try {
		await c.query(`DROP DATABASE IF EXISTS "${db}"`);
		console.log('  ' + db + ' dropped');
	} catch (e) {
		console.log('  drop failed: ' + e.message);
	}
	await c.end();
})().catch((e) => {
	console.error('FATAL:', e.message);
	process.exit(1);
});
